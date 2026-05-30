import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { UrlResultsService } from './url-results.service';

@Controller('url-results')
export class UrlResultsController {
  constructor(private readonly urlResultsService: UrlResultsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.urlResultsService.findOne(id);
  }

  @Put(':id/manual-verification')
  updateManualVerification(
    @Param('id') resultId: string,
    @Body('verificationId') verificationId: string,
    @Body('status') status: 'pending' | 'approved' | 'failed' | 'not_applicable',
  ) {
    return this.urlResultsService.updateManualVerification(resultId, verificationId, status);
  }

  @Patch(':id/applicability')
  updateApplicability(
    @Param('id') resultId: string,
    @Body('criterionId') criterionId: string,
    @Body('estado') estado: 'aplica' | 'no_aplica',
  ) {
    return this.urlResultsService.updateApplicability(resultId, criterionId, estado);
  }
}
