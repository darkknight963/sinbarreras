import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ScansService } from './scans.service';

@Controller('scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  triggerScan(
    @Body('projectId') projectId: string,
    @Body('urls') urls: string[],
    @Body('scanMode') scanMode: string,
    @Body('ux') ux: number,
    @Body('preNavigationScript') preNavigationScript?: string,
  ) {
    return this.scansService.triggerScan(projectId, urls, scanMode, ux, preNavigationScript);
  }

  @Get()
  findAll() {
    return this.scansService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scansService.findOne(id);
  }
}
