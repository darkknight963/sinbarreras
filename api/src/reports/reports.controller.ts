import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { Scan } from '../scans/entities/scan.entity';
import { ExcelService } from './excel.service';
import { PdfService } from './pdf.service';

/**
 * Task 5.1 — JSON Export API for CI/CD integrations
 *
 * Provides a structured JSON response containing complete scan data
 * compatible with CI/CD pipelines and external integrations.
 */
@Controller('reports')
export class ReportsController {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
  ) {}

  /**
   * GET /reports/:scanId/json
   * Returns the full scan result as structured JSON.
   */
  @Get(':scanId/json')
  async exportJson(@Param('scanId') scanId: string) {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      relations: { project: true, urlResults: true },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const totalViolations = scan.urlResults?.reduce(
      (acc, ur) => acc + (ur.violations?.length || 0), 0
    ) || 0;

    return {
      metadata: {
        scanId: scan.id,
        projectName: scan.project?.name,
        domain: scan.project?.domain,
        entityType: scan.project?.entityType,
        scanMode: scan.scanMode,
        createdAt: scan.createdAt,
        normativaAplicada: 'Resolución N° 001-2025-PCM/SGTD',
        wcagVersion: 'WCAG 2.2',
      },
      summary: {
        globalScore: scan.globalScore,
        totalPages: scan.urlResults?.length || 0,
        totalViolations,
        vp: {
          vo: scan.project?.vo,
          ux: scan.ux,
          value: scan.vp,
          category: (scan.vp ?? 0) >= 24 ? 'Alta' : (scan.vp ?? 0) >= 12 ? 'Media' : 'Baja',
        },
      },
      pages: scan.urlResults?.map(ur => ({
        url: ur.url,
        score: ur.score,
        status: ur.status,
        violationsCount: ur.violations?.length || 0,
        violations: ur.violations,
        manualVerifications: ur.manualVerifications,
      })),
    };
  }

  @Get(':scanId/excel')
  async exportExcel(@Param('scanId') scanId: string, @Res() res: Response) {
    const buffer = await this.excelService.generateExcel(scanId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-accesibilidad-${scanId}.xlsx"`,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    return res.send(buffer);
  }

  @Get(':scanId/pdf')
  async exportPdf(
    @Param('scanId') scanId: string,
    @Query('type') type: 'executive' | 'technical' = 'technical',
    @Res() res: Response,
  ) {
    const reportType = type === 'executive' ? 'executive' : 'technical';
    const buffer = await this.pdfService.generatePdf(scanId, reportType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-${reportType}-${scanId}.pdf"`,
    );
    res.setHeader('Content-Type', 'application/pdf');
    return res.send(buffer);
  }
}
