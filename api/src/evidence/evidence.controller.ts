import { Controller, Get, Header, NotFoundException, Param, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { EvidenceService } from './evidence.service';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

// Prefijo que el worker asigna a evidencias de scans sin propietario (análisis gratuitos).
// Solo estas keys son servibles sin autenticación.
const PUBLIC_EVIDENCE_PREFIX = 'public/';

@Controller(['evidence', 'api/evidence'])
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  // Evidencia de scans autenticados — requiere sesión válida.
  @Get(':key')
  @Header('X-Content-Type-Options', 'nosniff')
  async findOne(
    @Param('key') key: string,
    @Res() res: Response,
    @CurrentUser() user: { id: string } | null,
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere sesión para acceder a esta evidencia');
    }
    const evidence = await this.evidenceService.getEvidence(key);
    res.setHeader('Content-Type', evidence.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    evidence.body.pipe(res);
  }

  // Evidencia de análisis gratuitos — keys con prefijo 'public/' generadas por el worker.
  @Public()
  @Get('public/:key')
  @Header('X-Content-Type-Options', 'nosniff')
  async findPublicOne(@Param('key') key: string, @Res() res: Response) {
    const fullKey = `${PUBLIC_EVIDENCE_PREFIX}${key}`;
    if (!fullKey.startsWith(PUBLIC_EVIDENCE_PREFIX)) {
      throw new NotFoundException('Evidence not found');
    }
    const evidence = await this.evidenceService.getEvidence(fullKey);
    res.setHeader('Content-Type', evidence.contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    evidence.body.pipe(res);
  }
}
