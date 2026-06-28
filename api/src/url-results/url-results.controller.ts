import { Body, Controller, Get, Param, Patch, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { UrlResultsService } from './url-results.service';
import { resolveAccessScope } from '../auth/access-scope';

type AuthRequest = Request & {
  authMode?: 'service' | 'session';
};

type FindingReviewStatus = 'confirmed' | 'needs_review' | 'not_applicable';

@Controller('url-results')
export class UrlResultsController {
  constructor(private readonly urlResultsService: UrlResultsService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string; role?: string | null } | null, @Req() request?: AuthRequest) {
    const scope = resolveAccessScope(request, user);
    return this.urlResultsService.findOne(id, scope.ownerId, scope.includeAll);
  }

  @Put(':id/manual-verification')
  updateManualVerification(
    @Param('id') resultId: string,
    @Body('verificationId') verificationId: string,
    @Body('status') status: 'pending' | 'approved' | 'failed' | 'not_applicable',
    @CurrentUser() user: { id: string; role?: string | null } | null,
    @Req() request?: AuthRequest,
  ) {
    const scope = resolveAccessScope(request, user);
    return this.urlResultsService.updateManualVerification(resultId, verificationId, status, scope.ownerId, scope.includeAll);
  }

  @Patch(':id/applicability')
  updateApplicability(
    @Param('id') resultId: string,
    @Body('criterionId') criterionId: string,
    @Body('estado') estado: 'aplica' | 'no_aplica',
    @CurrentUser() user: { id: string; role?: string | null } | null,
    @Req() request?: AuthRequest,
  ) {
    const scope = resolveAccessScope(request, user);
    return this.urlResultsService.updateApplicability(resultId, criterionId, estado, scope.ownerId, scope.includeAll);
  }

  @Patch(':id/finding-status')
  updateFindingStatus(
    @Param('id') resultId: string,
    @Body('criterion') criterion: string,
    @Body('ruleId') ruleId: string,
    @Body('selector') selector: string,
    @Body('pageState') pageState: string | undefined,
    @Body('status') status: FindingReviewStatus,
    @CurrentUser() user: { id: string; role?: string | null } | null,
    @Req() request?: AuthRequest,
  ) {
    const scope = resolveAccessScope(request, user);
    return this.urlResultsService.updateFindingStatus(
      resultId,
      { criterion, ruleId, selector, pageState },
      status,
      scope.ownerId,
      scope.includeAll,
    );
  }
}
