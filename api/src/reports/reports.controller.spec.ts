import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { Scan } from '../scans/entities/scan.entity';
import { ExcelService } from './excel.service';
import { PdfService } from './pdf.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  const queryChain = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const scanRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => queryChain),
  };
  const excelService = {
    generateExcel: jest.fn(),
  };
  const pdfService = {
    generatePdf: jest.fn(),
  };

  const freeUser = {
    id: 'user-1',
    role: 'free',
    billingPlan: null,
    billingStatus: 'inactive',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: getRepositoryToken(Scan),
          useValue: scanRepository,
        },
        {
          provide: ExcelService,
          useValue: excelService,
        },
        {
          provide: PdfService,
          useValue: pdfService,
        },
      ],
    }).compile();

    controller = moduleRef.get(ReportsController);
    jest.clearAllMocks();
  });

  it('rejects free users trying to export json reports', async () => {
    scanRepository.findOne.mockResolvedValue({
      id: 'scan-1',
      project: null,
      urlResults: [],
    });

    const subject = controller as unknown as {
      exportJson: (scanId: string, user?: any) => Promise<unknown>;
    };

    await expect(subject.exportJson('scan-1', freeUser)).rejects.toBeInstanceOf(ForbiddenException);
    expect(scanRepository.findOne).not.toHaveBeenCalled();
  });

  it('scopes exports to the current owner when a session user requests them', async () => {
    queryChain.getOne.mockResolvedValue({
      id: 'scan-1',
      project: { name: 'Proyecto', domain: 'demo.pe', entityType: 'Sector privado' },
      urlResults: [],
      scanMode: 'estandar',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      normativeVersion: 'Resolucion',
      wcagVersion: 'WCAG 2.2',
      ruleSetVersion: '1.0.0',
    });

    const subject = controller as unknown as {
      exportJson: (scanId: string, user?: any, request?: any) => Promise<unknown>;
    };

    await expect(
      subject.exportJson('scan-1', {
        id: 'user-1',
        billingPlan: 'pro',
        billingStatus: 'active',
      }),
    ).resolves.toMatchObject({
      metadata: expect.objectContaining({ scanId: 'scan-1', projectName: 'Proyecto' }),
    });

    expect(scanRepository.createQueryBuilder).toHaveBeenCalledWith('scan');
    expect(queryChain.andWhere).toHaveBeenCalledWith('owner.id = :ownerId', { ownerId: 'user-1' });
  });

  it.each([
    ['exportExcel', 'xlsx'],
    ['exportPdf', 'pdf'],
  ])('rejects free users trying to export %s reports', async (methodName) => {
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    excelService.generateExcel.mockResolvedValue(Buffer.from('excel'));
    pdfService.generatePdf.mockResolvedValue(Buffer.from('pdf'));

    const subject = controller as unknown as {
      exportExcel: (scanId: string, res: any, user?: any) => Promise<unknown>;
      exportPdf: (scanId: string, type?: 'executive' | 'technical', res?: any, user?: any) => Promise<unknown>;
    };

    const call =
      methodName === 'exportExcel'
        ? subject.exportExcel('scan-1', res, freeUser)
        : subject.exportPdf('scan-1', 'technical', res, freeUser);

    await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    expect(res.send).not.toHaveBeenCalled();
  });

  it('lets superadmin export json for any scan without owner filter', async () => {
    queryChain.getOne.mockResolvedValue({
      id: 'scan-1',
      project: { name: 'Proyecto global', domain: 'demo.pe', entityType: 'Sector privado' },
      urlResults: [],
      scanMode: 'estandar',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      normativeVersion: 'Resolucion',
      wcagVersion: 'WCAG 2.2',
      ruleSetVersion: '1.0.0',
    });

    const subject = controller as unknown as {
      exportJson: (scanId: string, user?: any, request?: any) => Promise<unknown>;
    };

    await expect(
      subject.exportJson('scan-1', {
        id: 'super-1',
        role: 'superadmin',
        billingPlan: null,
        billingStatus: 'inactive',
      }),
    ).resolves.toMatchObject({
      metadata: expect.objectContaining({ scanId: 'scan-1' }),
    });

    expect(queryChain.andWhere).not.toHaveBeenCalledWith('owner.id = :ownerId', expect.anything());
  });
});
