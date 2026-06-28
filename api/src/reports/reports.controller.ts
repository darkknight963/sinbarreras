import { Controller, ForbiddenException, Get, NotFoundException, Param, Query, Req, Res } from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { Scan } from '../scans/entities/scan.entity';
import { ExcelService } from './excel.service';
import { PdfService } from './pdf.service';
import { RateLimit } from '../security/rate-limit.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { resolveAccessScope } from '../auth/access-scope';

type BillingAwareUser = {
  id: string;
  role?: string | null;
  billingPlan?: string | null;
  billingStatus?: string | null;
};

type AuthRequest = Request & {
  authMode?: 'service' | 'session';
};

const hasPaidBillingAccess = (user: BillingAwareUser | null | undefined) =>
  ['admin', 'superadmin'].includes(user?.role?.toLowerCase() || '') ||
  Boolean(user?.billingPlan && user.billingStatus === 'active');

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
  @RateLimit({ scope: 'report', limit: 120, windowMs: 15 * 60 * 1000 })
  async exportJson(
    @Param('scanId') scanId: string,
    @CurrentUser() user: BillingAwareUser | null,
    @Req() request?: AuthRequest,
  ) {
    this.assertExportAccess(user);
    const scope = resolveAccessScope(request, user);
    const scan = await this.findScanForExport(scanId, scope.ownerId, scope.includeAll);

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const allFindings = (scan.urlResults ?? []).flatMap((ur) => this.uniquePageFindings((ur.violations as any[]) ?? []));
    const totalFindings = allFindings.length;
    const totalViolations = allFindings.filter((v) => (v.findingStatus || v.status || 'confirmed') === 'confirmed').length;
    const reviewFindings = totalFindings - totalViolations;

    return {
      metadata: {
        scanId: scan.id,
        projectName: scan.project?.name,
        domain: scan.project?.domain,
        entityType: scan.project?.entityType,
        scanMode: scan.scanMode,
        createdAt: scan.createdAt,
        normativaAplicada: scan.normativeVersion,
        wcagVersion: scan.wcagVersion,
        ruleSetVersion: scan.ruleSetVersion,
      },
      summary: {
        globalScore: scan.globalScore,
        totalPages: scan.urlResults?.length || 0,
        totalFindings,
        totalViolations,
        reviewFindings,
        vp: {
          vo: scan.project?.vo,
          ux: scan.ux,
          value: scan.vp,
          category: (scan.vp ?? 0) >= 24 ? 'Alta' : (scan.vp ?? 0) >= 12 ? 'Media' : 'Baja',
        },
      },
      pages: scan.urlResults?.map(ur => {
        const pageFindings = this.uniquePageFindings((ur.violations as any[]) ?? []);
        return {
        url: ur.url,
        score: ur.score,
        status: ur.status,
        findingsCount: pageFindings.length,
        violationsCount: pageFindings.filter((v) => (v.findingStatus || v.status || 'confirmed') === 'confirmed').length,
        reviewFindingsCount: pageFindings.filter((v) => (v.findingStatus || v.status || 'confirmed') !== 'confirmed').length,
        applicability: ur.applicability,
        engineReport: ur.engineReport ?? [],
        violations: ur.violations,
        manualVerifications: ur.manualVerifications,
        };
      }),
    };
  }

  @Get(':scanId/excel')
  @RateLimit({ scope: 'report', limit: 120, windowMs: 15 * 60 * 1000 })
  async exportExcel(
    @Param('scanId') scanId: string,
    @Res() res: Response,
    @CurrentUser() user: BillingAwareUser | null,
    @Req() request?: AuthRequest,
  ) {
    this.assertExportAccess(user);
    const scope = resolveAccessScope(request, user);
    const buffer = await this.excelService.generateExcel(scanId, scope.ownerId, scope.includeAll);
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
  @RateLimit({ scope: 'report', limit: 120, windowMs: 15 * 60 * 1000 })
  async exportPdf(
    @Param('scanId') scanId: string,
    @Query('type') type: 'executive' | 'technical' = 'technical',
    @Res() res: Response,
    @CurrentUser() user: BillingAwareUser | null,
    @Req() request?: AuthRequest,
  ) {
    this.assertExportAccess(user);
    const reportType = type === 'executive' ? 'executive' : 'technical';
    const scope = resolveAccessScope(request, user);
    const buffer = await this.pdfService.generatePdf(scanId, reportType, scope.ownerId, scope.includeAll);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-${reportType}-${scanId}.pdf"`,
    );
    res.setHeader('Content-Type', 'application/pdf');
    return res.send(buffer);
  }

  private uniquePageFindings(findings: any[]): any[] {
    const map = new Map<string, any>();

    for (const finding of findings) {
      const key = `${String(finding.normalizedRuleId || finding.ruleId || finding.criterion || 'unknown')}::${String(finding.selector || '')}`;
      const current = map.get(key);

      if (!current) {
        map.set(key, finding);
        continue;
      }

      const currentStatus = current.findingStatus || current.status || 'confirmed';
      const nextStatus = finding.findingStatus || finding.status || 'confirmed';
      if (currentStatus !== 'confirmed' && nextStatus === 'confirmed') {
        map.set(key, finding);
      }
    }

    return Array.from(map.values());
  }

  private assertExportAccess(user: BillingAwareUser | null | undefined) {
    if (user && !hasPaidBillingAccess(user)) {
      throw new ForbiddenException('Los exportes están disponibles en Pro.');
    }
  }

  private async findScanForExport(scanId: string, ownerId: string | null, includeAll = false) {
    if (!includeAll && !ownerId) {
      throw new NotFoundException('Scan not found');
    }

    const query = this.scanRepository
      .createQueryBuilder('scan')
      .leftJoinAndSelect('scan.project', 'project')
      .leftJoinAndSelect('scan.urlResults', 'urlResults')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('scan.id = :scanId', { scanId });

    if (!includeAll && ownerId) {
      query.andWhere('owner.id = :ownerId', { ownerId });
    }

    const scan = await query.getOne();
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return scan;
  }
}
