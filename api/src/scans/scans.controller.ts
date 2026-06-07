import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common';
import { ScansService } from './scans.service';
import { CreateScanDto } from './dto/create-scan.dto';
import { RateLimit } from '../security/rate-limit.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';

type BillingAwareUser = {
  id: string;
  billingPlan?: string | null;
  billingStatus?: string | null;
};

const hasPaidBillingAccess = (user: BillingAwareUser | null | undefined) =>
  Boolean(user?.billingPlan && user.billingStatus === 'active');

@Controller('scans')
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Public()
  @Post('public')
  @RateLimit({ scope: 'scan', limit: 20, windowMs: 15 * 60 * 1000 })
  triggerPublicScan(@Body() createScanDto: { urls?: string[]; url?: string; scanMode?: string; ux?: number; entityType?: string }) {
    return this.scansService.triggerPublicScan(createScanDto);
  }

  @Public()
  @Get('public/:id')
  findPublicOne(@Param('id') id: string) {
    return this.scansService.findPublicOne(id);
  }

  @Post()
  @RateLimit({ scope: 'scan', limit: 20, windowMs: 15 * 60 * 1000 })
  triggerScan(@Body() createScanDto: CreateScanDto, @CurrentUser() user: BillingAwareUser | null, @Req() request: { authMode?: string }) {
    const urls = Array.isArray((createScanDto as { urls?: unknown }).urls) ? (createScanDto as { urls: string[] }).urls : [];
    if (request.authMode !== 'service' && user && !hasPaidBillingAccess(user) && urls.length > 1) {
      throw new ForbiddenException('El plan Free permite solo 1 URL por escaneo.');
    }
    if (urls.length === 0) {
      throw new BadRequestException('Debe proporcionar al menos una URL.');
    }
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.scansService.triggerScan(createScanDto, ownerId, {
      enforceSingleFreeUrl: request.authMode !== 'service' && Boolean(user) && !hasPaidBillingAccess(user),
    });
  }

  @Get()
  findAll(@CurrentUser() user: BillingAwareUser | null, @Req() request: { authMode?: string }) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.scansService.findAll(ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: BillingAwareUser | null, @Req() request: { authMode?: string }) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.scansService.findOne(id, ownerId);
  }

  @Post(':id/extension-result')
  @RateLimit({ scope: 'scan', limit: 60, windowMs: 15 * 60 * 1000 })
  submitExtensionResult(
    @Param('id') id: string,
    @Body() result: unknown,
    @CurrentUser() user: BillingAwareUser | null,
    @Req() request: { authMode?: string },
  ) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.scansService.submitExtensionResult(id, ownerId, result as any);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: BillingAwareUser | null, @Req() request: { authMode?: string }) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.scansService.remove(id, ownerId);
  }
}
