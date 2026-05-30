import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { Scan } from '../scans/entities/scan.entity';

type ReportType = 'executive' | 'technical';

type MetricTone = 'good' | 'warning' | 'danger' | 'neutral';

interface PdfFinding {
  url: string;
  pageScore?: number;
  criterion?: string;
  nameEs?: string;
  level?: string;
  severity?: string;
  role?: string;
  statusLabel?: string;
  pageState?: string;
  pageStateLabel?: string;
  description?: string;
  selector?: string;
  suggestedFix?: string;
  resolutionArticle?: string;
  elementHtml?: string;
  findingStatus?: string;
  status?: string;
  [key: string]: unknown;
}

interface PageSummary {
  url: string;
  score: number | null;
  status: string;
  confirmedCount: number;
  reviewCount: number;
}

interface ApplicabilityTotals {
  totalCriteria: number;
  applicableCount: number;
  passedCount: number;
  failedCount: number;
  notApplicableCount: number;
  pagesWithMatrix: number;
}

interface ReportModel {
  scan: Scan;
  findings: PdfFinding[];
  confirmedFindings: PdfFinding[];
  reviewFindings: PdfFinding[];
  pages: PageSummary[];
  severityCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  applicabilityTotals: ApplicabilityTotals | null;
}

const COLORS = {
  blue: '#002C76',
  blueDark: '#001F54',
  blueLight: '#EAF2FF',
  slate900: '#0F172A',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  green: '#047857',
  greenLight: '#D1FAE5',
  amber: '#B45309',
  amberLight: '#FEF3C7',
  red: '#B91C1C',
  redLight: '#FEE2E2',
  white: '#FFFFFF',
};

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
  ) {}

  async generatePdf(scanId: string, type: ReportType): Promise<Buffer> {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      relations: { project: true, urlResults: true },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const model = this.buildReportModel(scan);

    return this.buildPdf((doc) => {
      this.drawCover(doc, model, type);
      if (type === 'executive') {
        this.drawExecutiveReport(doc, model);
      } else {
        this.drawTechnicalReport(doc, model);
      }
    });
  }

  private buildReportModel(scan: Scan): ReportModel {
    const findings = (scan.urlResults ?? []).flatMap((ur) =>
      (((ur.violations as PdfFinding[]) ?? [])).map((v) => ({
        ...v,
        url: ur.url,
        pageScore: ur.score,
      })),
    );
    const confirmedFindings = findings.filter((v) => this.findingStatus(v) === 'confirmed');
    const reviewFindings = findings.filter((v) => this.findingStatus(v) !== 'confirmed');
    const pages = (scan.urlResults ?? []).map((ur) => {
      const pageFindings = ((ur.violations as PdfFinding[]) ?? []);
      return {
        url: ur.url,
        score: ur.score ?? null,
        status: ur.status,
        confirmedCount: pageFindings.filter((v) => this.findingStatus(v) === 'confirmed').length,
        reviewCount: pageFindings.filter((v) => this.findingStatus(v) !== 'confirmed').length,
      };
    });

    return {
      scan,
      findings,
      confirmedFindings,
      reviewFindings,
      pages,
      severityCounts: this.countBy(confirmedFindings, (v) => this.normalizeSeverity(v.severity)),
      roleCounts: this.countBy(confirmedFindings, (v) => String(v.role || 'Sin rol')),
      applicabilityTotals: this.getApplicabilityTotals(scan),
    };
  }

  private drawCover(doc: PDFKit.PDFDocument, model: ReportModel, type: ReportType) {
    const { scan } = model;
    const score = scan.globalScore ?? 0;
    const tone = this.scoreTone(score);
    const reportTitle = type === 'executive' ? 'Reporte Ejecutivo de Accesibilidad' : 'Reporte Técnico de Accesibilidad';

    doc.rect(0, 0, doc.page.width, 160).fill(COLORS.blueDark);
    doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold')
      .text('PLATAFORMA DE ACCESIBILIDAD WEB', 40, 34, { characterSpacing: 0.6 });
    doc.fontSize(24).text(reportTitle, 40, 58, { width: 430 });
    doc.fontSize(10).font('Helvetica')
      .fillColor('#DBEAFE')
      .text('Resolución N. 001-2025-PCM/SGTD | WCAG 2.2', 40, 118);

    this.drawScoreBadge(doc, score, tone, 442, 42);

    doc.y = 190;
    this.drawSectionTitle(doc, 'Datos del análisis');
    this.drawKeyValueGrid(doc, [
      ['Proyecto', scan.project?.name ?? '-'],
      ['Entidad', scan.project?.entityType ?? '-'],
      ['Dominio', scan.project?.domain ?? '-'],
      ['Fecha', this.formatDate(scan.createdAt)],
      ['Modo', scan.scanMode ?? '-'],
      ['Priorización Vp', `${scan.vp ?? 0} (${this.priorityLabel(scan.vp ?? 0)})`],
    ]);

    doc.moveDown(1.2);
    this.drawMetricCards(doc, [
      { label: 'Puntaje global', value: `${score}/100`, tone },
      { label: 'Páginas auditadas', value: String(model.pages.length), tone: 'neutral' },
      { label: 'Hallazgos confirmados', value: String(model.confirmedFindings.length), tone: model.confirmedFindings.length > 0 ? 'danger' : 'good' },
      { label: 'En revision', value: String(model.reviewFindings.length), tone: model.reviewFindings.length > 0 ? 'warning' : 'neutral' },
    ]);

    doc.moveDown(1.4);
    this.drawInsightBox(
      doc,
      'Lectura rápida',
      this.executiveVerdict(model),
      tone,
    );

    doc.addPage();
  }

  private drawExecutiveReport(doc: PDFKit.PDFDocument, model: ReportModel) {
    const { scan } = model;
    const score = scan.globalScore ?? 0;
    const critical = model.severityCounts.critico ?? 0;
    const high = model.severityCounts.alto ?? 0;

    this.drawSectionTitle(doc, 'Resumen para decisión');
    this.drawParagraph(doc, this.executiveVerdict(model));

    doc.moveDown(0.8);
    this.drawMetricCards(doc, [
      { label: 'Nivel de cumplimiento', value: this.scoreLabel(score), tone: this.scoreTone(score) },
      { label: 'Críticos', value: String(critical), tone: critical > 0 ? 'danger' : 'good' },
      { label: 'Altos', value: String(high), tone: high > 0 ? 'warning' : 'good' },
      { label: 'Prioridad legal', value: this.priorityLabel(scan.vp ?? 0), tone: (scan.vp ?? 0) >= 24 ? 'danger' : (scan.vp ?? 0) >= 12 ? 'warning' : 'neutral' },
    ]);

    doc.moveDown(1.1);
    this.drawSectionTitle(doc, 'Aplicabilidad WCAG');
    if (model.applicabilityTotals) {
      const totals = model.applicabilityTotals;
      this.drawKeyValueGrid(doc, [
        ['Páginas con matriz', String(totals.pagesWithMatrix)],
        ['Criterios aplicables', String(totals.applicableCount)],
        ['Criterios que cumplen', String(totals.passedCount)],
        ['Criterios que fallan', String(totals.failedCount)],
        ['No aplican', String(totals.notApplicableCount)],
        ['Base WCAG', `${totals.totalCriteria} criterios`],
      ]);
    } else {
      this.drawParagraph(doc, 'No se encontró matriz de aplicabilidad WCAG en este análisis.');
    }

    doc.moveDown(1.1);
    this.drawSectionTitle(doc, 'Hallazgos por severidad');
    this.drawTable(doc, ['Severidad', 'Cantidad', 'Prioridad'], [
      ['Crítico', String(model.severityCounts.critico ?? 0), 'Atención inmediata'],
      ['Alto', String(model.severityCounts.alto ?? 0), 'Siguiente ciclo'],
      ['Medio', String(model.severityCounts.medio ?? 0), 'Plan de remediación'],
      ['Bajo', String(model.severityCounts.bajo ?? 0), 'Mejora continua'],
    ], [170, 90, 230]);

    doc.moveDown(1.1);
    this.drawSectionTitle(doc, 'Responsables sugeridos');
    const roleRows = Object.entries(model.roleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([role, count]) => [role, String(count), this.roleAction(role)]);
    this.drawTable(doc, ['Rol', 'Hallazgos', 'Foco'], roleRows.length ? roleRows : [['Sin hallazgos', '0', 'Mantener monitoreo']], [160, 90, 240]);

    doc.moveDown(1.1);
    this.drawSectionTitle(doc, 'Plan recomendado');
    this.drawBulletList(doc, [
      'Cerrar primero hallazgos criticos y altos en paginas con menor puntaje o mayor valor Vp.',
      'Asignar responsables por rol: desarrollo para semantica/teclado, UX/UI para contraste y componentes, redaccion UX para textos y proposito de enlaces.',
      'Reejecutar el escaneo despues de cada lote de correcciones y conservar evidencia de remediacion.',
      'Completar verificaciones manuales pendientes antes de usar el resultado como sustento de cumplimiento.',
    ]);

    doc.moveDown(1.1);
    this.drawSectionTitle(doc, 'Paginas con mayor riesgo');
    const riskyPages = [...model.pages]
      .sort((a, b) => (a.score ?? 101) - (b.score ?? 101))
      .slice(0, 8)
      .map((page) => [page.url, page.score === null ? '-' : `${page.score}/100`, String(page.confirmedCount)]);
    this.drawTable(doc, ['URL', 'Score', 'Hallazgos'], riskyPages.length ? riskyPages : [['Sin paginas auditadas', '-', '-']], [310, 80, 100]);
  }

  private drawTechnicalReport(doc: PDFKit.PDFDocument, model: ReportModel) {
    this.drawSectionTitle(doc, 'Alcance tecnico');
    this.drawKeyValueGrid(doc, [
      ['Páginas evaluadas', String(model.pages.length)],
      ['Hallazgos confirmados', String(model.confirmedFindings.length)],
      ['Hallazgos por revisar', String(model.reviewFindings.length)],
      ['Estándar', 'WCAG 2.2'],
      ['Normativa', 'Resolución N. 001-2025-PCM/SGTD'],
      ['Score global', `${model.scan.globalScore ?? 0}/100`],
    ]);

    doc.moveDown(1.1);
    this.drawSectionTitle(doc, 'Resumen por página');
    this.drawTable(doc, ['URL', 'Score', 'Confirmados', 'Revision'], model.pages.map((page) => [
      page.url,
      page.score === null ? '-' : `${page.score}/100`,
      String(page.confirmedCount),
      String(page.reviewCount),
    ]), [280, 70, 80, 80]);

    doc.moveDown(1.1);
    this.drawSectionTitle(doc, 'Matriz de remediación');
    const sortedFindings = [...model.findings].sort((a, b) => {
      const severityDelta = this.severityRank(b.severity) - this.severityRank(a.severity);
      if (severityDelta !== 0) return severityDelta;
      return this.findingStatus(a) === 'confirmed' ? -1 : 1;
    });

    if (sortedFindings.length === 0) {
      this.drawInsightBox(doc, 'Sin hallazgos', 'No se registraron violaciones en el escaneo.', 'good');
      return;
    }

    sortedFindings.slice(0, 80).forEach((finding, index) => {
      this.drawFindingCard(doc, finding, index + 1);
    });

    if (sortedFindings.length > 80) {
      doc.moveDown(0.5);
      this.drawParagraph(doc, `Se muestran los 80 hallazgos de mayor prioridad de ${sortedFindings.length}. Use el Excel para la matriz completa.`);
    }
  }

  private drawFindingCard(doc: PDFKit.PDFDocument, finding: PdfFinding, index: number) {
    this.ensureSpace(doc, 135);
    const x = doc.page.margins.left;
    const y = doc.y;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const severity = this.normalizeSeverity(finding.severity);
    const tone = severity === 'critico' || severity === 'alto' ? 'danger' : severity === 'medio' ? 'warning' : 'neutral';
    const color = this.toneColor(tone);

    doc.roundedRect(x, y, width, 118, 8).fillAndStroke(COLORS.white, COLORS.slate200);
    doc.rect(x, y, 5, 118).fill(color.fg);
    doc.fillColor(COLORS.slate900).font('Helvetica-Bold').fontSize(10)
      .text(`${index}. ${finding.criterion ?? 'N/A'} | ${finding.nameEs ?? finding.description ?? 'Hallazgo de accesibilidad'}`, x + 14, y + 12, { width: width - 28, lineGap: 1 });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.slate600)
      .text(`URL: ${finding.url}`, x + 14, doc.y + 3, { width: width - 28 });
    doc.text(`Nivel: ${finding.level ?? finding.wcagLevel ?? 'N/A'} | Severidad: ${finding.severity ?? 'N/A'} | Estado: ${finding.statusLabel ?? this.findingStatusLabel(finding)} | Rol: ${finding.role ?? '-'}`, x + 14, doc.y + 3, { width: width - 28 });
    doc.text(`Vista: ${finding.pageStateLabel || (finding.pageState === 'initial' ? 'Estado inicial' : 'Despues de cerrar modales')}`, x + 14, doc.y + 3, { width: width - 28 });
    doc.text(`Selector: ${finding.selector ?? '-'}`, x + 14, doc.y + 3, { width: width - 28 });
    doc.text(`Acción: ${finding.suggestedFix ?? 'Revisar y corregir según el criterio WCAG indicado.'}`, x + 14, doc.y + 3, { width: width - 28 });
    doc.text(`Referencia: ${finding.resolutionArticle ?? '-'}`, x + 14, doc.y + 3, { width: width - 28 });
    doc.y = y + 132;
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    this.ensureSpace(doc, 42);
    doc.fillColor(COLORS.blue).font('Helvetica-Bold').fontSize(14).text(title);
    doc.moveTo(doc.page.margins.left, doc.y + 4)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
      .strokeColor(COLORS.blueLight)
      .lineWidth(1.5)
      .stroke();
    doc.moveDown(0.9);
  }

  private drawParagraph(doc: PDFKit.PDFDocument, text: string) {
    doc.fillColor(COLORS.slate700).font('Helvetica').fontSize(10).text(text, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: 3,
    });
  }

  private drawBulletList(doc: PDFKit.PDFDocument, items: string[]) {
    for (const item of items) {
      this.ensureSpace(doc, 28);
      const x = doc.page.margins.left;
      doc.circle(x + 4, doc.y + 6, 2.3).fill(COLORS.blue);
      doc.fillColor(COLORS.slate700).font('Helvetica').fontSize(9.5)
        .text(item, x + 16, doc.y, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 16, lineGap: 2 });
      doc.moveDown(0.45);
    }
  }

  private drawMetricCards(
    doc: PDFKit.PDFDocument,
    cards: Array<{ label: string; value: string; tone: MetricTone }>,
  ) {
    const gap = 10;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const width = (usableWidth - gap * (cards.length - 1)) / cards.length;
    const height = 70;
    const startY = doc.y;

    cards.forEach((card, index) => {
      const x = doc.page.margins.left + index * (width + gap);
      const tone = this.toneColor(card.tone);
      doc.roundedRect(x, startY, width, height, 8).fillAndStroke(tone.bg, tone.border);
      doc.fillColor(tone.fg).font('Helvetica-Bold').fontSize(18)
        .text(card.value, x + 12, startY + 15, { width: width - 24 });
      doc.fillColor(COLORS.slate700).font('Helvetica-Bold').fontSize(7.5)
        .text(card.label.toUpperCase(), x + 12, startY + 43, { width: width - 24 });
    });

    doc.y = startY + height + 12;
  }

  private drawKeyValueGrid(doc: PDFKit.PDFDocument, rows: Array<[string, string]>) {
    const x = doc.page.margins.left;
    const startY = doc.y;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = width / 2;
    const rowHeight = 34;

    rows.forEach(([label, value], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const cellX = x + col * colWidth;
      const cellY = startY + row * rowHeight;
      doc.roundedRect(cellX, cellY, colWidth - 6, rowHeight - 6, 5).fillAndStroke(COLORS.slate50, COLORS.slate200);
      doc.fillColor(COLORS.slate500).font('Helvetica-Bold').fontSize(7.5)
        .text(label.toUpperCase(), cellX + 9, cellY + 6, { width: colWidth - 24 });
      doc.fillColor(COLORS.slate900).font('Helvetica').fontSize(9)
        .text(value, cellX + 9, cellY + 18, { width: colWidth - 24, ellipsis: true });
    });

    doc.y = startY + Math.ceil(rows.length / 2) * rowHeight + 6;
  }

  private drawInsightBox(doc: PDFKit.PDFDocument, title: string, text: string, tone: MetricTone) {
    this.ensureSpace(doc, 92);
    const x = doc.page.margins.left;
    const y = doc.y;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colors = this.toneColor(tone);
    doc.roundedRect(x, y, width, 82, 8).fillAndStroke(colors.bg, colors.border);
    doc.fillColor(colors.fg).font('Helvetica-Bold').fontSize(11).text(title, x + 14, y + 12, { width: width - 28 });
    doc.fillColor(COLORS.slate700).font('Helvetica').fontSize(9.5).text(text, x + 14, y + 31, { width: width - 28, lineGap: 2 });
    doc.y = y + 96;
  }

  private drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], widths: number[]) {
    const x = doc.page.margins.left;
    const padding = 6;
    const headerHeight = 24;
    this.ensureSpace(doc, headerHeight + 28);
    let y = doc.y;

    doc.rect(x, y, widths.reduce((sum, value) => sum + value, 0), headerHeight).fill(COLORS.blue);
    headers.forEach((header, index) => {
      const cellX = x + widths.slice(0, index).reduce((sum, value) => sum + value, 0);
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(8)
        .text(header, cellX + padding, y + 8, { width: widths[index] - padding * 2 });
    });
    y += headerHeight;

    for (const row of rows) {
      const heights = row.map((cell, index) => doc.heightOfString(cell || '-', {
        width: widths[index] - padding * 2,
      }) + 14);
      const rowHeight = Math.max(28, ...heights);
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 24) {
        doc.addPage();
        y = doc.y;
      }
      row.forEach((cell, index) => {
        const cellX = x + widths.slice(0, index).reduce((sum, value) => sum + value, 0);
        doc.rect(cellX, y, widths[index], rowHeight).fillAndStroke(index % 2 === 0 ? COLORS.white : COLORS.slate50, COLORS.slate200);
        doc.fillColor(COLORS.slate700).font('Helvetica').fontSize(8.2)
          .text(cell || '-', cellX + padding, y + 7, { width: widths[index] - padding * 2, lineGap: 1 });
      });
      y += rowHeight;
    }

    doc.y = y + 12;
  }

  private drawScoreBadge(doc: PDFKit.PDFDocument, score: number, tone: MetricTone, x: number, y: number) {
    const color = this.toneColor(tone);
    doc.roundedRect(x, y, 104, 72, 12).fillAndStroke(color.bg, '#FFFFFF');
    doc.fillColor(color.fg).font('Helvetica-Bold').fontSize(26).text(String(score), x, y + 12, { width: 104, align: 'center' });
    doc.fillColor(COLORS.slate700).font('Helvetica-Bold').fontSize(8).text('/100', x, y + 42, { width: 104, align: 'center' });
  }

  private buildPdf(write: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        write(doc);
        this.addPageNumbers(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private addPageNumbers(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.slate500)
        .text(
          `Página ${i + 1} de ${range.count}`,
          doc.page.margins.left,
          doc.page.height - 28,
          { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'right' },
        );
    }
  }

  private ensureSpace(doc: PDFKit.PDFDocument, height: number) {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  private getApplicabilityTotals(scan: Scan): ApplicabilityTotals | null {
    const summaries = (scan.urlResults ?? [])
      .map((ur) => (ur.applicability as any)?.summary)
      .filter(Boolean);

    if (summaries.length === 0) return null;

    return summaries.reduce((acc, item) => ({
      totalCriteria: item.totalCriteria || acc.totalCriteria,
      applicableCount: acc.applicableCount + (item.applicableCount || 0),
      passedCount: acc.passedCount + (item.passedCount || 0),
      failedCount: acc.failedCount + (item.failedCount || 0),
      notApplicableCount: acc.notApplicableCount + (item.notApplicableCount || 0),
      pagesWithMatrix: acc.pagesWithMatrix + 1,
    }), {
      totalCriteria: 86,
      applicableCount: 0,
      passedCount: 0,
      failedCount: 0,
      notApplicableCount: 0,
      pagesWithMatrix: 0,
    });
  }

  private countBy(items: PdfFinding[], key: (item: PdfFinding) => string): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      const value = key(item);
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  }

  private executiveVerdict(model: ReportModel): string {
    const score = model.scan.globalScore ?? 0;
    const critical = model.severityCounts.critico ?? 0;
    const high = model.severityCounts.alto ?? 0;
    if (score >= 90 && critical === 0 && high === 0) {
      return 'El sitio muestra un nivel alto de cumplimiento. Mantenga monitoreo periódico y cierre cualquier verificación manual pendiente antes de declarar cumplimiento formal.';
    }
    if (critical > 0 || high > 0) {
      return `El sitio requiere remediación prioritaria: existen ${critical} hallazgos críticos y ${high} altos confirmados. La atención debe concentrarse en las páginas de menor score y en los criterios WCAG con impacto legal directo.`;
    }
    return 'El sitio presenta brechas moderadas de accesibilidad. Conviene planificar correcciones por rol responsable y validar nuevamente para evidenciar mejora de cumplimiento.';
  }

  private scoreTone(score: number): MetricTone {
    if (score >= 80) return 'good';
    if (score >= 50) return 'warning';
    return 'danger';
  }

  private scoreLabel(score: number): string {
    if (score >= 90) return 'Alto';
    if (score >= 70) return 'Aceptable';
    if (score >= 50) return 'Medio';
    return 'En riesgo';
  }

  private priorityLabel(vp: number): string {
    if (vp >= 24) return 'Alta';
    if (vp >= 12) return 'Media';
    return 'Baja';
  }

  private roleAction(role: string): string {
    if (role.includes('Desarrollador')) return 'Semántica, teclado, ARIA y estructura HTML';
    if (role.includes('Diseñador') || role.includes('Disenador')) return 'Contraste, foco visible y estados de componentes';
    if (role.includes('Redactor')) return 'Textos alternativos, etiquetas y proposito de enlaces';
    if (role.includes('Compartido')) return 'Coordinar diseno, contenido y desarrollo';
    return 'Asignar responsable de remediacion';
  }

  private normalizeSeverity(severity: unknown): string {
    const value = String(severity || 'sin severidad')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (value.includes('critico')) return 'critico';
    if (value.includes('alto')) return 'alto';
    if (value.includes('medio')) return 'medio';
    if (value.includes('bajo')) return 'bajo';
    return value;
  }

  private severityRank(severity: unknown): number {
    const normalized = this.normalizeSeverity(severity);
    if (normalized === 'critico') return 4;
    if (normalized === 'alto') return 3;
    if (normalized === 'medio') return 2;
    if (normalized === 'bajo') return 1;
    return 0;
  }

  private toneColor(tone: MetricTone) {
    if (tone === 'good') return { bg: COLORS.greenLight, border: '#A7F3D0', fg: COLORS.green };
    if (tone === 'warning') return { bg: COLORS.amberLight, border: '#FDE68A', fg: COLORS.amber };
    if (tone === 'danger') return { bg: COLORS.redLight, border: '#FECACA', fg: COLORS.red };
    return { bg: COLORS.slate50, border: COLORS.slate200, fg: COLORS.slate700 };
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Lima',
    }).format(date);
  }

  private findingStatus(v: PdfFinding): string {
    return String(v.findingStatus || v.status || 'confirmed');
  }

  private findingStatusLabel(v: PdfFinding): string {
    const status = this.findingStatus(v);
    if (status === 'not_evaluated') return 'No evaluado';
    if (status === 'not_applicable') return 'No aplicable';
    if (status === 'needs_review') return 'Requiere revision';
    return 'Confirmado';
  }
}
