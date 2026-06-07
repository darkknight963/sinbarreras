import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
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
    @CurrentUser() user: { id: string } | null,
    @Req() request: { authMode?: string },
  ) {
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
  update(@Param('id') id: string, @Body() updateData: any, @CurrentUser() user: { id: string } | null, @Req() request: { authMode?: string }) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.projectsService.update(id, updateData, ownerId);
  }

  @Delete(':id')
  @RateLimit({ scope: 'project', limit: 60, windowMs: 60 * 60 * 1000 })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string } | null, @Req() request: { authMode?: string }) {
    const ownerId = request.authMode === 'service' ? null : user?.id ?? null;
    return this.projectsService.remove(id, ownerId);
  }
}
