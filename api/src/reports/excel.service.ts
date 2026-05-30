import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Scan } from '../scans/entities/scan.entity';

/**
 * Task 5.2 — Excel Report Generator
 *
 * Generates an XLSX workbook with multiple sheets separated by role:
 *   Sheet 1: Resumen Ejecutivo
 *   Sheet 2: Todos los Errores
 *   Sheet 3: Errores del Desarrollador
 *   Sheet 4: Errores del Diseñador UX/UI
 *   Sheet 5: Errores del Redactor UX
 *   Sheet 6: Checklist 86 Criterios WCAG 2.2
 *   Sheet 7: Normativa Peruana
 *   Sheet 8: Matriz de Priorización
 */
@Injectable()
export class ExcelService {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
  ) {}

  async generateExcel(scanId: string): Promise<Buffer> {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      relations: { project: true, urlResults: true },
    });

    if (!scan) throw new Error('Scan not found');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Peru Accessibility Analyzer';
    workbook.created = new Date();

    // ── Sheet 1: Resumen Ejecutivo ──
    const summarySheet = workbook.addWorksheet('Resumen Ejecutivo');
    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 40 },
      { header: 'Valor', key: 'value', width: 40 },
    ];
    this.styleHeader(summarySheet);

    const allErrors = this.collectAllViolations(scan);
    const confirmedErrors = allErrors.filter((v) => this.findingStatus(v) === 'confirmed');
    const reviewErrors = allErrors.filter((v) => this.findingStatus(v) !== 'confirmed');
    const totalViolations = confirmedErrors.length;

    summarySheet.addRows([
      { metric: 'Proyecto', value: scan.project?.name || '' },
      { metric: 'Dominio', value: scan.project?.domain || '' },
      { metric: 'Tipo de Entidad', value: scan.project?.entityType || '' },
      { metric: 'Fecha de Análisis', value: scan.createdAt.toISOString() },
      { metric: 'Modo de Escaneo', value: scan.scanMode },
      { metric: 'Puntaje Global', value: `${scan.globalScore}/100` },
      { metric: 'Total de Páginas', value: String(scan.urlResults?.length || 0) },
      { metric: 'Total de Violaciones', value: String(totalViolations) },
      { metric: 'Vo (Volumen de Visitas)', value: String(scan.project?.vo) },
      { metric: 'Ux (Impacto en Experiencia)', value: String(scan.ux) },
      { metric: 'Vp (Valor de Priorización)', value: String(scan.vp) },
      { metric: 'Categoría de Priorización', value: (scan.vp ?? 0) >= 24 ? 'Alta' : (scan.vp ?? 0) >= 12 ? 'Media' : 'Baja' },
      { metric: 'Normativa Aplicada', value: 'Resolución N° 001-2025-PCM/SGTD' },
      { metric: 'Estándar WCAG', value: 'WCAG 2.2' },
    ]);

    // ── Sheet 2: Todos los Errores ──
    this.createViolationsSheet(workbook, 'Todos los Errores', allErrors);
    this.createViolationsSheet(workbook, 'Violaciones Confirmadas', confirmedErrors);
    this.createViolationsSheet(workbook, 'Revision y Cobertura', reviewErrors);

    // ── Sheet 3: Errores del Desarrollador ──
    const devErrors = allErrors.filter(e => e.role === 'Desarrollador' || e.role === 'Compartido');
    this.createViolationsSheet(workbook, 'Errores Desarrollador', devErrors);

    // ── Sheet 4: Errores del Diseñador ──
    const designErrors = allErrors.filter(e => e.role === 'Diseñador UX/UI' || e.role === 'Compartido');
    this.createViolationsSheet(workbook, 'Errores Diseñador UX-UI', designErrors);

    // ── Sheet 5: Errores del Redactor UX ──
    const writerErrors = allErrors.filter(e => e.role === 'Redactor UX' || e.role === 'Compartido');
    this.createViolationsSheet(workbook, 'Errores Redactor UX', writerErrors);

    // ── Sheet 6: Checklist de aplicabilidad ──
    this.createApplicabilitySheet(workbook, scan);

    // ── Sheet 7: Normativa Peruana ──
    const normativaSheet = workbook.addWorksheet('Normativa Peruana');
    normativaSheet.columns = [
      { header: 'Artículo', key: 'article', width: 20 },
      { header: 'Descripción', key: 'description', width: 50 },
      { header: 'Estado', key: 'status', width: 15 },
    ];
    this.styleHeader(normativaSheet);

    // ── Sheet 8: Matriz de Priorización ──
    const prioSheet = workbook.addWorksheet('Matriz Priorización');
    prioSheet.columns = [
      { header: 'URL', key: 'url', width: 50 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Vo', key: 'vo', width: 8 },
      { header: 'Ux', key: 'ux', width: 8 },
      { header: 'Vp', key: 'vp', width: 8 },
      { header: 'Categoría', key: 'category', width: 20 },
    ];
    this.styleHeader(prioSheet);

    if (scan.urlResults) {
      for (const ur of scan.urlResults) {
        const vp = (scan.project?.vo || 4) * scan.ux;
        prioSheet.addRow({
          url: ur.url,
          score: ur.score,
          vo: scan.project?.vo || 4,
          ux: scan.ux,
          vp,
          category: vp >= 24 ? 'Alta' : vp >= 12 ? 'Media' : 'Baja',
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private collectAllViolations(scan: Scan) {
    const all: any[] = [];
    if (!scan.urlResults) return all;

    for (const ur of scan.urlResults) {
      if (!ur.violations) continue;
      for (const v of ur.violations as any[]) {
        all.push({
          url: ur.url,
          ...v,
        });
      }
    }
    return all;
  }

  private createViolationsSheet(workbook: ExcelJS.Workbook, sheetName: string, violations: any[]) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
      { header: 'URL', key: 'url', width: 40 },
      { header: 'Criterio WCAG', key: 'criterion', width: 12 },
      { header: 'Nombre (ES)', key: 'nameEs', width: 35 },
      { header: 'Nivel WCAG', key: 'level', width: 10 },
      { header: 'Severidad', key: 'severity', width: 12 },
      { header: 'Estado', key: 'statusLabel', width: 18 },
      { header: 'Vista evaluada', key: 'pageStateLabel', width: 24 },
      { header: 'Rol Responsable', key: 'role', width: 18 },
      { header: 'Discapacidad', key: 'disability', width: 30 },
      { header: 'Descripción', key: 'description', width: 50 },
      { header: 'Elemento HTML', key: 'elementHtml', width: 40 },
      { header: 'Selector CSS', key: 'selector', width: 30 },
      { header: 'Solución Sugerida', key: 'suggestedFix', width: 40 },
      { header: 'Ref. Normativa', key: 'resolutionArticle', width: 30 },
    ];
    this.styleHeader(sheet);

    for (const v of violations) {
      sheet.addRow({
        url: v.url,
        criterion: v.criterion,
        nameEs: v.nameEs,
        level: v.level,
        severity: v.severity,
        statusLabel: v.statusLabel || this.findingStatusLabel(v),
        pageStateLabel: v.pageStateLabel || (v.pageState === 'initial' ? 'Estado inicial' : 'Despues de cerrar modales'),
        role: v.role,
        disability: Array.isArray(v.disability) ? v.disability.join(', ') : v.disability,
        description: v.description,
        elementHtml: v.elementHtml,
        selector: v.selector,
        suggestedFix: v.suggestedFix,
        resolutionArticle: v.resolutionArticle,
      });
    }
  }

  private createApplicabilitySheet(workbook: ExcelJS.Workbook, scan: Scan) {
    const sheet = workbook.addWorksheet('Checklist 86 WCAG');
    sheet.columns = [
      { header: 'URL', key: 'url', width: 45 },
      { header: 'Criterio', key: 'criterion', width: 12 },
      { header: 'Nombre', key: 'name', width: 42 },
      { header: 'Nivel', key: 'level', width: 8 },
      { header: 'Aplicabilidad', key: 'applicability', width: 16 },
      { header: 'Resultado', key: 'result', width: 18 },
      { header: 'Razon', key: 'reason', width: 60 },
      { header: 'Hallazgos', key: 'findingCount', width: 12 },
      { header: 'Severidad', key: 'severity', width: 12 },
      { header: 'Estado hallazgo', key: 'findingStatus', width: 18 },
      { header: 'Vista evaluada', key: 'pageStateLabel', width: 24 },
      { header: 'Descripcion', key: 'description', width: 50 },
      { header: 'Selector CSS', key: 'selector', width: 30 },
      { header: 'Rol', key: 'role', width: 18 },
      { header: 'Solucion sugerida', key: 'suggestedFix', width: 40 },
      { header: 'Articulo legal', key: 'resolutionArticle', width: 30 },
    ];
    this.styleHeader(sheet);

    for (const ur of scan.urlResults ?? []) {
      const applicability = (ur.applicability as any) || {};
      const criteria = Array.isArray(applicability.criteria) ? applicability.criteria : [];
      const failed = new Set(
        (((ur.violations as any[]) ?? [])
          .filter((v) => this.findingStatus(v) === 'confirmed')
          .map((v) => v.criterion))
      );
      const findingsByCriterion = new Map<string, any[]>();
      for (const violation of ((ur.violations as any[]) ?? [])) {
        const current = findingsByCriterion.get(violation.criterion) || [];
        current.push(violation);
        findingsByCriterion.set(violation.criterion, current);
      }

      for (const criterion of criteria) {
        const findings = findingsByCriterion.get(criterion.id) || [];
        const primaryFinding = findings.find((v) => this.findingStatus(v) === 'confirmed') || findings[0];
        const result = criterion.estado === 'no_aplica'
          ? 'N/A'
          : failed.has(criterion.id)
            ? 'Falla'
            : 'Cumple';

        sheet.addRow({
          url: ur.url,
          criterion: criterion.id,
          name: criterion.nombre,
          level: criterion.nivel,
          applicability: criterion.estado,
          result,
          reason: criterion.razon,
          findingCount: criterion.estado === 'aplica' && findings.length > 0 ? findings.length : '',
          severity: primaryFinding?.severity || '',
          findingStatus: primaryFinding ? primaryFinding.statusLabel || this.findingStatusLabel(primaryFinding) : '',
          pageStateLabel: primaryFinding ? primaryFinding.pageStateLabel || (primaryFinding.pageState === 'initial' ? 'Estado inicial' : 'Despues de cerrar modales') : '',
          description: primaryFinding?.description || '',
          selector: primaryFinding?.selector || '',
          role: primaryFinding?.role || '',
          suggestedFix: primaryFinding?.suggestedFix || '',
          resolutionArticle: primaryFinding?.resolutionArticle || '',
        });
      }
    }
  }

  private styleHeader(sheet: ExcelJS.Worksheet) {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF002C76' }, // Official Gob.pe Blue
    };
    headerRow.alignment = { vertical: 'middle' };
  }

  private findingStatus(v: any): string {
    return v.findingStatus || v.status || 'confirmed';
  }

  private findingStatusLabel(v: any): string {
    const status = this.findingStatus(v);
    if (status === 'not_evaluated') return 'No evaluado';
    if (status === 'not_applicable') return 'No aplicable';
    if (status === 'needs_review') return 'Requiere revision';
    return 'Confirmado';
  }
}
