import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UrlResult } from './entities/url-result.entity';
import { Scan } from '../scans/entities/scan.entity';

type ApplicabilityState = 'aplica' | 'no_aplica';
type ManualStatus = 'pending' | 'approved' | 'failed' | 'not_applicable';
type FindingReviewStatus = 'confirmed' | 'needs_review' | 'not_applicable';

type FindingLocator = {
  criterion: string;
  ruleId: string;
  selector: string;
  pageState?: string;
};

const isSpecificCriterion = (criterion: unknown): criterion is string => {
  return typeof criterion === 'string' && /^\d+\.\d+\.\d+$/.test(criterion);
};

@Injectable()
export class UrlResultsService {
  constructor(
    @InjectRepository(UrlResult)
    private readonly urlResultRepository: Repository<UrlResult>,
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
  ) {}

  async findOne(id: string, ownerId: string | null = null): Promise<UrlResult | null> {
    const query = this.urlResultRepository
      .createQueryBuilder('urlResult')
      .leftJoinAndSelect('urlResult.scan', 'scan')
      .leftJoinAndSelect('scan.project', 'project')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('urlResult.id = :id', { id });

    if (ownerId) {
      query.andWhere('owner.id = :ownerId', { ownerId });
    }

    return query.getOne();
  }

  async updateManualVerification(
    resultId: string,
    verificationId: string,
    status: ManualStatus,
    ownerId: string | null = null,
  ): Promise<UrlResult> {
    if (!['pending', 'approved', 'failed', 'not_applicable'].includes(status)) {
      throw new BadRequestException('Invalid manual verification status');
    }

    const result = await this.findOne(resultId, ownerId);
    if (!result) throw new NotFoundException('URL result not found');

    const verifications = result.manualVerifications || [];
    let verificationFound = false;
    const updatedVerifications = verifications.map((v: any) => {
      if (v.id === verificationId) {
        verificationFound = true;
        return { ...v, status };
      }
      return v;
    });

    if (!verificationFound) {
      throw new NotFoundException('Manual verification not found');
    }

    result.manualVerifications = updatedVerifications;
    this.recalculateUrlResultScore(result);

    const saved = await this.urlResultRepository.save(result);
    await this.recalculateScanScore(result.scan?.id);

    return this.findOne(saved.id, ownerId) as Promise<UrlResult>;
  }

  async updateApplicability(
    resultId: string,
    criterionId: string,
    estado: ApplicabilityState,
    ownerId: string | null = null,
  ): Promise<UrlResult> {
    if (!criterionId || !isSpecificCriterion(criterionId)) {
      throw new BadRequestException('criterionId must be a WCAG criterion id');
    }

    if (estado !== 'aplica' && estado !== 'no_aplica') {
      throw new BadRequestException('estado must be aplica or no_aplica');
    }

    const result = await this.findOne(resultId, ownerId);

    if (!result) throw new NotFoundException('URL result not found');
    if (!result.applicability?.criteria?.length) {
      throw new BadRequestException('This URL result does not have an applicability matrix');
    }

    let criterionFound = false;
    const criteria = result.applicability.criteria.map((criterion: any) => {
      if (criterion.id !== criterionId) return criterion;
      criterionFound = true;
      return {
        ...criterion,
        estado,
        razon:
          estado === 'aplica'
            ? 'Editado manualmente: criterio marcado como aplicable.'
            : 'Editado manualmente: criterio marcado como no aplicable.',
      };
    });

    if (!criterionFound) {
      throw new NotFoundException('WCAG criterion not found in applicability matrix');
    }

    result.applicability = {
      ...result.applicability,
      criteria,
    };
    this.recalculateUrlResultScore(result);

    const saved = await this.urlResultRepository.save(result);
    await this.recalculateScanScore(result.scan?.id);

    return this.findOne(saved.id, ownerId) as Promise<UrlResult>;
  }

  async updateFindingStatus(
    resultId: string,
    locator: FindingLocator,
    status: FindingReviewStatus,
    ownerId: string | null = null,
  ): Promise<UrlResult> {
    if (!['confirmed', 'needs_review', 'not_applicable'].includes(status)) {
      throw new BadRequestException('Invalid finding status');
    }

    if (!locator.criterion || !locator.ruleId || !locator.selector) {
      throw new BadRequestException('criterion, ruleId and selector are required');
    }

    const result = await this.findOne(resultId, ownerId);
    if (!result) throw new NotFoundException('URL result not found');

    let findingFound = false;
    const statusLabel =
      status === 'confirmed'
        ? 'Confirmado: falla'
        : status === 'not_applicable'
          ? 'Confirmado: cumple'
          : 'Requiere revisión';

    const matchesLocator = (finding: any) => {
      const sameCriterion = String(finding.criterion || '') === locator.criterion;
      const sameRule = String(finding.ruleId || '') === locator.ruleId;
      const sameSelector = String(finding.selector || '') === locator.selector;
      const sameState = !locator.pageState || String(finding.pageState || '') === locator.pageState;
      return sameCriterion && sameRule && sameSelector && sameState;
    };

    const applyStatus = (finding: any) => ({
      ...finding,
      findingStatus: status,
      status,
      statusLabel,
      reviewedAt: new Date().toISOString(),
    });

    result.violations = (result.violations || []).map((violation: any) => {
      if (!matchesLocator(violation)) {
        return violation;
      }

      findingFound = true;
      return applyStatus(violation);
    });

    if (!findingFound) {
      result.manualVerifications = (result.manualVerifications || []).map((verification: any) => {
        if (!matchesLocator(verification)) {
          return verification;
        }

        findingFound = true;
        return applyStatus(verification);
      });
    }

    if (!findingFound) {
      throw new NotFoundException('Finding not found');
    }

    this.recalculateUrlResultScore(result);

    const saved = await this.urlResultRepository.save(result);
    await this.recalculateScanScore(result.scan?.id);

    return this.findOne(saved.id, ownerId) as Promise<UrlResult>;
  }

  private recalculateUrlResultScore(result: UrlResult): void {
    const criteria = result.applicability?.criteria || [];
    if (!criteria.length) return;

    const failedCriterionIds = new Set(
      (result.violations || [])
        .filter((violation: any) => (violation.findingStatus || violation.status || 'confirmed') === 'confirmed')
        .map((violation: any) => violation.criterion)
        .filter(isSpecificCriterion),
    );
    const reviewCriterionIds = new Set(
      (result.violations || [])
        .filter((violation: any) => {
          const status = violation.findingStatus || violation.status || 'confirmed';
          return status === 'needs_review' || status === 'not_evaluated';
        })
        .map((violation: any) => violation.criterion)
        .filter(isSpecificCriterion),
    );

    for (const verification of result.manualVerifications || []) {
      if (!isSpecificCriterion(verification.criterion)) continue;
      const status = verification.findingStatus || verification.status || (verification.ruleId || verification.selector ? 'needs_review' : 'pending');
      if (status === 'confirmed' || status === 'failed') {
        failedCriterionIds.add(verification.criterion);
      } else if (status === 'pending' || status === 'needs_review' || status === 'not_evaluated') {
        reviewCriterionIds.add(verification.criterion);
      }
    }

    const notApplicableManualIds = new Set(
      (result.manualVerifications || [])
        .filter((verification: any) => verification.status === 'not_applicable' || verification.findingStatus === 'not_applicable')
        .map((verification: any) => verification.criterion)
        .filter(isSpecificCriterion),
    );

    const applicableCriteria = criteria.filter(
      (criterion: any) => criterion.estado === 'aplica' && !notApplicableManualIds.has(criterion.id),
    );
    const failedCount = applicableCriteria.filter((criterion: any) => failedCriterionIds.has(criterion.id)).length;
    const reviewCount = applicableCriteria.filter(
      (criterion: any) => !failedCriterionIds.has(criterion.id) && reviewCriterionIds.has(criterion.id),
    ).length;
    const applicableCount = applicableCriteria.length;
    const notApplicableCount = criteria.length - applicableCount;
    const passedCount = Math.max(applicableCount - failedCount - reviewCount, 0);
    const score = applicableCount > 0 ? Math.round((passedCount / applicableCount) * 100) : 100;

    result.applicability = {
      ...result.applicability,
      criteria,
      summary: {
        totalCriteria: criteria.length,
        applicableCount,
        notApplicableCount,
        failedCount,
        reviewCount,
        passedCount,
        score,
      },
    };
    result.score = score;
  }

  private async recalculateScanScore(scanId?: string): Promise<void> {
    if (!scanId) return;

    const urlResults = await this.urlResultRepository.find({
      where: { scan: { id: scanId } },
    });
    const scores = urlResults
      .map((urlResult) => urlResult.score)
      .filter((score): score is number => typeof score === 'number');

    const scan = await this.scanRepository.findOne({ where: { id: scanId } });
    if (!scan) return;

    scan.globalScore = scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;
    await this.scanRepository.save(scan);
  }
}
