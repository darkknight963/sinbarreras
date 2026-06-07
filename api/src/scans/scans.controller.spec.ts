import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

describe('ScansController', () => {
  let controller: ScansController;
  const scansService = {
    triggerScan: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ScansController],
      providers: [
        {
          provide: ScansService,
          useValue: scansService,
        },
      ],
    }).compile();

    controller = moduleRef.get(ScansController);
    jest.clearAllMocks();
  });

  it('rejects free users trying to scan more than one url', async () => {
    expect(() =>
      controller.triggerScan(
        {
          projectId: 'project-1',
          urls: ['https://example.com', 'https://example.org'],
        } as any,
        {
          id: 'user-1',
          billingPlan: null,
          billingStatus: 'inactive',
        } as any,
        { authMode: 'session' } as any,
      ),
    ).toThrow(ForbiddenException);

    expect(scansService.triggerScan).not.toHaveBeenCalled();
  });
});
