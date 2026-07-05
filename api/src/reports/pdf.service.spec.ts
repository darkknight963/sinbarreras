import { NotFoundException } from '@nestjs/common';
import { PdfService } from './pdf.service';

const scanFixture = {
  id: 'scan-1',
  status: 'completed',
  globalScore: 62,
  ux: 4,
  vp: 16,
  scanMode: 'estandar',
  createdAt: new Date('2026-05-30T12:00:00.000Z'),
  project: {
    name: 'Portal de Servicios',
    domain: 'https://www.gob.pe',
    entityType: 'Administracion Publica Peruana',
    vo: 4,
  },
  urlResults: [
    {
      url: 'https://www.gob.pe/tramites',
      score: 58,
      status: 'completed',
      applicability: {
        summary: {
          totalCriteria: 86,
          applicableCount: 42,
          passedCount: 34,
          failedCount: 8,
          notApplicableCount: 44,
        },
      },
      violations: [
        {
          criterion: '1.4.3',
          nameEs: 'Contraste minimo',
          level: 'AA',
          severity: 'critico',
          role: 'Diseñador UX/UI',
          status: 'confirmed',
          description: 'El texto no cumple contraste minimo.',
          selector: '.hero-title',
          suggestedFix: 'Ajustar color de texto y fondo.',
          resolutionArticle: 'Anexo 1 - Criterio 1.4.3',
          pageStateLabel: 'Estado inicial',
        },
        {
          criterion: '2.4.1',
          nameEs: 'Omitir bloques',
          level: 'A',
          severity: 'medio',
          role: 'Desarrollador',
          status: 'needs_review',
          description: 'Revisar enlace de salto al contenido.',
          selector: 'body',
          suggestedFix: 'Agregar skip link visible al foco.',
          resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
        },
      ],
    },
  ],
};

function countPdfPages(buffer: Buffer): number {
  const matches = buffer.toString('latin1').match(/\/Type\s+\/Page\b/g);
  return matches?.length ?? 0;
}

describe('PdfService', () => {
  it('generates an executive PDF buffer with a PDF header', async () => {
    const service = new PdfService({ findOne: jest.fn().mockResolvedValue(scanFixture) } as any);

    const buffer = await service.generatePdf('scan-1', 'executive', null, true);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(2500);
    expect(countPdfPages(buffer)).toBeLessThanOrEqual(6);
  });

  it('generates a technical PDF buffer with a PDF header', async () => {
    const service = new PdfService({ findOne: jest.fn().mockResolvedValue(scanFixture) } as any);

    const buffer = await service.generatePdf('scan-1', 'technical', null, true);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(3000);
    expect(countPdfPages(buffer)).toBeLessThanOrEqual(7);
  });

  it('throws NotFoundException when the scan does not exist', async () => {
    const service = new PdfService({ findOne: jest.fn().mockResolvedValue(null) } as any);

    await expect(service.generatePdf('missing', 'executive', null, true)).rejects.toBeInstanceOf(NotFoundException);
  });
});
