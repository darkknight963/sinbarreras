import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Scan } from '../scans/entities/scan.entity';
import { WCAG_CHECKLIST, flattenWcagChecklist } from '../compliance/wcag-checklist.data';

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
 *   Sheet 7: WCAG Completa
 */
@Injectable()
export class ExcelService {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
  ) {}

  async generateExcel(scanId: string, ownerId: string | null = null): Promise<Buffer> {
    const scan = await this.findScanForReport(scanId, ownerId);

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
    const reviewErrors = allErrors.filter((v) => this.isReviewFinding(v));
    const totalViolations = this.countAffectedFindings(confirmedErrors);
    const totalReviewItems = this.countAffectedFindings(reviewErrors);

    summarySheet.addRows([
      { metric: 'Proyecto', value: scan.project?.name || '' },
      { metric: 'Dominio', value: scan.project?.domain || '' },
      { metric: 'Tipo de Entidad', value: scan.project?.entityType || '' },
      { metric: 'Fecha de Análisis', value: scan.createdAt.toISOString() },
      { metric: 'Modo de Escaneo', value: scan.scanMode },
      { metric: 'Puntaje Global', value: `${scan.globalScore}/100` },
      { metric: 'Total de Páginas', value: String(scan.urlResults?.length || 0) },
      { metric: 'Total de Violaciones', value: String(totalViolations) },
      { metric: 'Total requiere revision', value: String(totalReviewItems) },
      { metric: 'Vo (Volumen de Visitas)', value: String(scan.project?.vo) },
      { metric: 'Ux (Impacto en Experiencia)', value: String(scan.ux) },
      { metric: 'Vp (Valor de Priorización)', value: String(scan.vp) },
      { metric: 'Categoría de Priorización', value: (scan.vp ?? 0) >= 24 ? 'Alta' : (scan.vp ?? 0) >= 12 ? 'Media' : 'Baja' },
      { metric: 'Normativa Aplicada', value: scan.normativeVersion },
      { metric: 'Estándar WCAG', value: scan.wcagVersion },
      { metric: 'Versión de Reglas', value: scan.ruleSetVersion },
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

    // ── Sheet 7: WCAG Completa ──
    this.createWcagEvaluationSheet(workbook, scan);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async findScanForReport(scanId: string, ownerId: string | null) {
    if (!ownerId && typeof (this.scanRepository as any).findOne === 'function') {
      const scan = await this.scanRepository.findOne({
        where: { id: scanId },
        relations: { project: true, urlResults: true },
      });

      if (!scan) {
        throw new NotFoundException('Scan not found');
      }

      return scan;
    }

    const query = this.scanRepository
      .createQueryBuilder('scan')
      .leftJoinAndSelect('scan.project', 'project')
      .leftJoinAndSelect('scan.urlResults', 'urlResults')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('scan.id = :scanId', { scanId });

    if (ownerId) {
      query.andWhere('owner.id = :ownerId', { ownerId });
    }

    const scan = await query.getOne();
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return scan;
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
        pageStateLabel: v.pageStateLabel || (v.pageState === 'initial' ? 'Estado inicial' : 'Después de cerrar modales'),
        role: v.role,
        disability: Array.isArray(v.disability) ? v.disability.join(', ') : v.disability,
        description: v.description,
        elementHtml: v.elementHtml,
        selector: v.selector,
        suggestedFix: v.suggestedFix,
      });
    }
  }

  private createWcagEvaluationSheet(workbook: ExcelJS.Workbook, scan: Scan) {
    const sheet = workbook.addWorksheet('WCAG Completa');
    sheet.columns = [
      { header: 'URL', key: 'url', width: 42 },
      { header: 'Tipo', key: 'type', width: 16 },
      { header: 'Principio', key: 'principle', width: 18 },
      { header: 'Criterio', key: 'criterion', width: 12 },
      { header: 'Nombre', key: 'name', width: 42 },
      { header: 'Nivel', key: 'level', width: 8 },
      { header: 'Aplicabilidad', key: 'applicability', width: 16 },
      { header: 'Resultado', key: 'result', width: 16 },
      { header: 'Razon', key: 'reason', width: 48 },
      { header: 'Hallazgos', key: 'findingCount', width: 14 },
      { header: 'Severidad', key: 'severity', width: 12 },
      { header: 'Estado hallazgo', key: 'findingStatus', width: 18 },
      { header: 'Vista evaluada', key: 'pageStateLabel', width: 24 },
      { header: 'Descripcion', key: 'description', width: 48 },
      { header: 'Selector CSS', key: 'selector', width: 30 },
      { header: 'Rol', key: 'role', width: 18 },
      { header: 'Solucion sugerida', key: 'suggestedFix', width: 40 },
    ];
    this.styleHeader(sheet);

    const criteriaById = new Map<string, any>();
    const principlesByCriterion = new Map<string, { principleId: number; principleName: string }>();
    for (const entry of flattenWcagChecklist()) {
      criteriaById.set(entry.criterionId, entry);
      principlesByCriterion.set(entry.criterionId, {
        principleId: entry.principleId,
        principleName: entry.principleName,
      });
    }

    for (const ur of scan.urlResults ?? []) {
      const applicability = (ur.applicability as any) || {};
      const criteria = Array.isArray(applicability.criteria) ? applicability.criteria : [];
      const violationsByCriterion = new Map<string, any[]>();
      const manualByCriterion = new Map<string, any[]>();

      for (const violation of ((ur.violations as any[]) ?? [])) {
        const current = violationsByCriterion.get(violation.criterion) || [];
        current.push(violation);
        violationsByCriterion.set(violation.criterion, current);
      }

      for (const verification of ((ur.manualVerifications as any[]) ?? [])) {
        const current = manualByCriterion.get(verification.criterion) || [];
        current.push(verification);
        manualByCriterion.set(verification.criterion, current);
      }

      for (const principle of WCAG_CHECKLIST.principles) {
        const principleRows = criteria.filter((criterion: any) => principlesByCriterion.get(criterion.id)?.principleId === principle.id);
        if (principleRows.length === 0) continue;

        const principleRow = sheet.addRow({
          url: ur.url,
          type: 'Principio',
          principle: `${principle.id}. ${principle.name}`,
        });
        principleRow.font = { bold: true };
        principleRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8EDF5' },
        };

        for (const criterion of principleRows) {
          const criterionMeta = criteriaById.get(criterion.id);
          const findings = violationsByCriterion.get(criterion.id) || [];
          const manualVerifications = manualByCriterion.get(criterion.id) || [];
          const confirmedFindings = findings.filter((finding) => this.findingStatus(finding) === 'confirmed');
          const reviewFindings = findings.filter((finding) => this.isReviewFinding(finding));
          const primaryFinding = confirmedFindings[0] || findings[0];
          const result = criterion.estado === 'no_aplica'
            ? 'N/A'
            : confirmedFindings.length > 0
              ? 'Falla'
              : reviewFindings.length > 0
                ? 'Requiere revision'
                : 'Cumple';
          const findingCount = this.countAffectedFindings(findings);
          sheet.addRow({
            url: ur.url,
            type: 'Criterio',
            principle: `${principle.id}. ${principle.name}`,
            criterion: criterion.id,
            name: criterionMeta?.criterionName || criterion.nombre,
            level: criterion.nivel || criterionMeta?.level || '',
            applicability: criterion.estado,
            result,
            reason: criterion.razon,
            findingCount: criterion.estado === 'aplica' && findingCount > 0
              ? `${findingCount} hallazgo(s)`
              : '',
            severity: primaryFinding?.severity || '',
            findingStatus: primaryFinding ? primaryFinding.statusLabel || this.findingStatusLabel(primaryFinding) : '',
            pageStateLabel: primaryFinding ? primaryFinding.pageStateLabel || (primaryFinding.pageState === 'initial' ? 'Estado inicial' : 'Después de cerrar modales') : '',
            description: this.summarizeFindingText(findings, 'description') || primaryFinding?.description || '',
            selector: primaryFinding?.selector || '',
            role: primaryFinding?.role || '',
            suggestedFix: primaryFinding?.suggestedFix || '',
          });
        }
      }
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
        const hasReviewFinding = findings.some((v) => this.isReviewFinding(v));
        const result = criterion.estado === 'no_aplica'
          ? 'N/A'
          : failed.has(criterion.id)
            ? 'Falla'
            : hasReviewFinding
              ? 'Requiere revision'
              : 'Cumple';
        const findingCount = this.countAffectedFindings(findings);

        sheet.addRow({
          url: ur.url,
          criterion: criterion.id,
          name: criterion.nombre,
          level: criterion.nivel,
          applicability: criterion.estado,
          result,
          reason: criterion.razon,
          findingCount: criterion.estado === 'aplica' && findingCount > 0 ? findingCount : '',
          severity: primaryFinding?.severity || '',
          findingStatus: primaryFinding ? primaryFinding.statusLabel || this.findingStatusLabel(primaryFinding) : '',
          pageStateLabel: primaryFinding ? primaryFinding.pageStateLabel || (primaryFinding.pageState === 'initial' ? 'Estado inicial' : 'Después de cerrar modales') : '',
            description: this.summarizeFindingText(findings, 'description') || primaryFinding?.description || '',
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

  private isReviewFinding(v: any): boolean {
    const status = this.findingStatus(v);
    return status === 'needs_review' || status === 'not_evaluated';
  }

  private countAffectedFindings(findings: any[]): number {
    return (findings || []).reduce((total, finding) => {
      const affectedElements = Array.isArray(finding?.affectedElements) ? finding.affectedElements.length : 0;
      const htmlSamples = Array.isArray(finding?.affectedHtmlSamples) ? finding.affectedHtmlSamples.length : 0;
      return total + Math.max(1, affectedElements, htmlSamples);
    }, 0);
  }

  private splitReportText(value?: string | null): string[] {
    return String(value || '')
      .split(/\s*\|\s*/)
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  private summarizeFindingText(findings: any[], field: string): string {
    const counts = new Map<string, number>();

    for (const finding of findings || []) {
      const parts = this.splitReportText(finding?.[field]);
      if (parts.length === 0) continue;

      const partCounts = new Map<string, number>();
      for (const part of parts) {
        partCounts.set(part, (partCounts.get(part) || 0) + 1);
      }

      const affectedElements = Array.isArray(finding?.affectedElements) ? finding.affectedElements.length : 0;
      const htmlSamples = Array.isArray(finding?.affectedHtmlSamples) ? finding.affectedHtmlSamples.length : 0;
      const affectedCount = Math.max(1, affectedElements, htmlSamples);

      for (const [part, partCount] of partCounts.entries()) {
        const count = partCounts.size === 1 ? Math.max(partCount, affectedCount) : partCount;
        counts.set(part, (counts.get(part) || 0) + count);
      }
    }

    return Array.from(counts.entries())
      .map(([text, count]) => count > 1 ? `${text} (${count} elementos afectados)` : text)
      .join(' | ');
  }

  private findingStatusLabel(v: any): string {
    const status = this.findingStatus(v);
    if (status === 'not_evaluated') return 'No evaluado';
    if (status === 'not_applicable') return 'No aplicable';
    if (status === 'needs_review') return 'Requiere revisión';
    return 'Confirmado';
  }

  private manualVerificationStatusLabel(status: string): string {
    if (status === 'approved') return 'Cumple';
    if (status === 'failed') return 'No cumple';
    if (status === 'not_applicable') return 'No aplica';
    return 'Pendiente';
  }
}
