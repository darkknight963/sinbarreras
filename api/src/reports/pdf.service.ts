import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { Scan } from '../scans/entities/scan.entity';

type ReportType = 'executive' | 'technical';

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

    const allViolations = (scan.urlResults ?? []).flatMap((ur) =>
      ((ur.violations as any[]) ?? []).map((v) => ({ ...v, url: ur.url })),
    );

    const totalViolations = allViolations.length;
    const criticalCount = allViolations.filter((v) => v.severity === 'crítico').length;

    return this.buildPdf((doc) => {
      doc.fontSize(18).fillColor('#111827').text('Reporte de Accesibilidad Web', { underline: true });
      doc.moveDown(0.8);

      doc.fontSize(10).fillColor('#334155')
        .text(`Proyecto: ${scan.project?.name ?? '-'}`)
        .text(`Dominio: ${scan.project?.domain ?? '-'}`)
        .text(`Fecha: ${scan.createdAt.toISOString()}`)
        .text(`Tipo: ${type === 'executive' ? 'Ejecutivo' : 'Técnico'}`);

      doc.moveDown(1);
      doc.fontSize(11).fillColor('#111827')
        .text(`Puntaje global: ${scan.globalScore ?? 0}/100`)
        .text(`Páginas: ${scan.urlResults?.length ?? 0}`)
        .text(`Violaciones: ${totalViolations}`)
        .text(`Vp: ${scan.vp ?? 0}`)
        .text(`Críticas: ${criticalCount}`);

      doc.moveDown(1);
      if (type === 'executive') {
        doc.fontSize(13).fillColor('#be123c').text('Resumen Ejecutivo', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#1f2937')
          .text(`Estado general: ${(scan.globalScore ?? 0) >= 90 ? 'Cumplimiento alto' : 'Requiere mejoras prioritarias'}`)
          .text(`Priorización legal (Vp): ${scan.vp ?? 0}`)
          .text('Se recomienda atender primero hallazgos críticos y altos por impacto en servicios públicos.');
      } else {
        doc.fontSize(13).fillColor('#be123c').text('Detalle Técnico de Violaciones', { underline: true });
        doc.moveDown(0.5);

        const sample = allViolations.slice(0, 60);
        if (sample.length === 0) {
          doc.fontSize(10).fillColor('#1f2937').text('No se registraron violaciones en el escaneo.');
        }

        for (const v of sample) {
          if (doc.y > 720) doc.addPage();
          doc.fontSize(10).fillColor('#0f172a').text(`${v.criterion ?? 'N/A'} | ${v.nameEs ?? 'Regla'} | ${v.severity ?? 'N/A'}`, { continued: false });
          doc.fontSize(9).fillColor('#334155')
            .text(`URL: ${v.url ?? '-'}`)
            .text(`Selector: ${v.selector ?? '-'}`)
            .text(`Descripción: ${v.description ?? '-'}`)
            .text(`Sugerencia: ${v.suggestedFix ?? '-'}`)
            .moveDown(0.8);
        }
      }
    });
  }

  private buildPdf(write: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        write(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
