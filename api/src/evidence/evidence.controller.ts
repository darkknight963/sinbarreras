import { Controller, Get, NotFoundException, Param, Redirect, UnauthorizedException } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

const PUBLIC_EVIDENCE_PREFIX = 'public/';

@Controller(['evidence', 'api/evidence'])
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  // Evidencia de scans autenticados — requiere sesión válida, redirige a presigned URL de R2.
  @Get(':key')
  @Redirect()
  async findOne(
    @Param('key') key: string,
    @CurrentUser() user: { id: string } | null,
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere sesión para acceder a esta evidencia');
    }
    const url = await this.evidenceService.getPresignedUrl(key);
    return { url, statusCode: 302 };
  }

  // Evidencia de análisis gratuitos — sin auth, redirige a presigned URL de R2.
  @Public()
  @Get('public/:key')
  @Redirect()
  async findPublicOne(@Param('key') key: string) {
    const fullKey = `${PUBLIC_EVIDENCE_PREFIX}${key}`;
    if (!fullKey.startsWith(PUBLIC_EVIDENCE_PREFIX)) {
      throw new NotFoundException('Evidence not found');
    }
    const url = await this.evidenceService.getPresignedUrl(fullKey);
    return { url, statusCode: 302 };
  }
}
