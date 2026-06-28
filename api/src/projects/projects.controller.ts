import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { RateLimit } from '../security/rate-limit.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RateLimit({ scope: 'project', limit: 60, windowMs: 60 * 60 * 1000 })
  create(
    @Body('name') name: string,
    @Body('domain') domain: string,
    @Body('vo') vo: number,
    @Body('entityType') entityType: string,
    @CurrentUser() user: {
      id: string;
      role?: string | null;
      billingStatus?: string | null;
      billingPlan?: string | null;
    } | null,
    @Req() request: { authMode?: string },
  ) {
    const role = user?.role?.toLowerCase() || 'free';
    const hasPaidAccess =
      role === 'admin' ||
      role === 'superadmin' ||
      Boolean(user?.billingPlan && user.billingStatus === 'active');
    if (request.authMode !== 'service' && !hasPaidAccess) {
      throw new ForbiddenException('La creación de proyectos está disponible en Pro.');
    }
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.projectsService.create(name, domain, vo, entityType, ownerId);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string } | null, @Req() request: { authMode?: string }) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.projectsService.findAll(ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string } | null, @Req() request: { authMode?: string }) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.projectsService.findOne(id, ownerId);
  }

  @Put(':id')
  @RateLimit({ scope: 'project', limit: 60, windowMs: 60 * 60 * 1000 })
  update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { id: string } | null,
    @Req() request: { authMode?: string },
  ) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    // Whitelist allowed fields to prevent mass-assignment of sensitive columns (owner, vo, etc.).
    const allowed = ['name', 'domain', 'entityType'] as const;
    const updateData: Record<string, unknown> = {};
    for (const field of allowed) {
      if (field in body) updateData[field] = body[field];
    }
    return this.projectsService.update(id, updateData, ownerId);
  }

  @Delete(':id')
  @RateLimit({ scope: 'project', limit: 60, windowMs: 60 * 60 * 1000 })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string } | null, @Req() request: { authMode?: string }) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.projectsService.remove(id, ownerId);
  }
}
