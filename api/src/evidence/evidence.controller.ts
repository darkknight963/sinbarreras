import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EvidenceService } from './evidence.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get(':key')
  @Header('X-Content-Type-Options', 'nosniff')
  async findOne(@Param('key') key: string, @Res() res: Response) {
    const evidence = await this.evidenceService.getEvidence(key);

    res.setHeader('Content-Type', evidence.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    evidence.body.pipe(res);
  }
}
