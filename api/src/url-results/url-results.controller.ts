import { Controller, Get, Param, Put, Body } from '@nestjs/common';
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
    @Body('status') status: string,
  ) {
    return this.urlResultsService.updateManualVerification(resultId, verificationId, status);
  }
}
