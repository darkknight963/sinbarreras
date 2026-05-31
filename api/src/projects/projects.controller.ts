import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { RateLimit } from '../security/rate-limit.decorator';

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
  ) {
    return this.projectsService.create(name, domain, vo, entityType);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Put(':id')
  @RateLimit({ scope: 'project', limit: 60, windowMs: 60 * 60 * 1000 })
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.projectsService.update(id, updateData);
  }

  @Delete(':id')
  @RateLimit({ scope: 'project', limit: 60, windowMs: 60 * 60 * 1000 })
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
