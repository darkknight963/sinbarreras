import * as ExcelJS from 'exceljs';
import { ExcelService } from './excel.service';

describe('ExcelService', () => {
  it('creates a full WCAG evaluation sheet and omits the normative tabs', async () => {
    const scanFixture = {
      id: 'scan-1',
      createdAt: new Date('2026-05-31T12:00:00.000Z'),
      scanMode: 'estandar',
      globalScore: 87,
      normativeVersion: 'Resolucion N° 001-2025-PCM/SGTD',
      wcagVersion: 'WCAG 2.2',
      ruleSetVersion: '1.0.0',
      ux: 4,
      vp: 16,
      project: {
        name: 'Proyecto demo',
        domain: 'demo.gob.pe',
        entityType: 'Sector privado',
        vo: 4,
      },
      urlResults: [
        {
          url: 'https://demo.gob.pe',
          score: 87,
          applicability: {
            criteria: [
              {
                id: '1.1.1',
                nombre: 'Contenido no textual',
                nivel: 'A',
                estado: 'aplica',
                razon: 'Aplica porque el sitio usa iconos con texto alternativo',
              },
            ],
          },
          violations: [
            {
              criterion: '1.1.1',
              nameEs: 'Contenido no textual',
              level: 'A',
              severity: 'alto',
              statusLabel: 'Confirmado',
              pageStateLabel: 'Estado inicial',
              role: 'Diseñador UX/UI',
              disability: 'Visual',
              description: 'Falta texto alternativo en imagen decorativa',
              elementHtml: '<img src="hero.png">',
              selector: 'img.hero',
              suggestedFix: 'Agregar alt descriptivo',
              findingStatus: 'confirmed',
            },
          ],
          manualVerifications: [],
        },
      ],
    } as any;

    const service = new ExcelService({ findOne: jest.fn().mockResolvedValue(scanFixture) } as any);
    const buffer = await service.generateExcel('scan-1');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Resumen Ejecutivo',
      'Todos los Errores',
      'Violaciones Confirmadas',
      'Revision y Cobertura',
      'Errores Desarrollador',
      'Errores Diseñador UX-UI',
      'Errores Redactor UX',
      'Checklist 86 WCAG',
      'WCAG Completa',
    ]);

    const violationsSheet = workbook.getWorksheet('Todos los Errores');
    expect(violationsSheet?.getRow(1).values).toEqual([
      undefined,
      'URL',
      'Criterio WCAG',
      'Nombre (ES)',
      'Nivel WCAG',
      'Severidad',
      'Estado',
      'Vista evaluada',
      'Rol Responsable',
      'Discapacidad',
      'Descripción',
      'Elemento HTML',
      'Selector CSS',
      'Solución Sugerida',
    ]);

    const wcagSheet = workbook.getWorksheet('WCAG Completa');
    expect(wcagSheet?.getRow(1).values).toEqual([
      undefined,
      'URL',
      'Tipo',
      'Principio',
      'Criterio',
      'Nombre',
      'Nivel',
      'Aplicabilidad',
      'Resultado',
      'Razon',
      'Hallazgos',
      'Severidad',
      'Estado hallazgo',
      'Evaluacion manual',
      'Vista evaluada',
      'Descripcion',
      'Selector CSS',
      'Rol',
      'Solucion sugerida',
    ]);
    expect(wcagSheet?.rowCount).toBeGreaterThanOrEqual(3);
    expect(wcagSheet?.getCell('A2').value).toBe('https://demo.gob.pe');
    expect(wcagSheet?.getCell('B2').value).toBe('Principio');
    expect(wcagSheet?.getCell('B3').value).toBe('Criterio');
  });
});
