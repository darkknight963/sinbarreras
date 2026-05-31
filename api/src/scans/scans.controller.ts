import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ScansService } from './scans.service';
import { CreateScanDto } from './dto/create-scan.dto';
import { RateLimit } from '../security/rate-limit.decorator';

@Controller('scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  @RateLimit({ scope: 'scan', limit: 20, windowMs: 15 * 60 * 1000 })
  triggerScan(@Body() createScanDto: CreateScanDto) {
    return this.scansService.triggerScan(createScanDto);
  }

  @Get()
  findAll() {
    return this.scansService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scansService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scansService.remove(id);
  }
}
