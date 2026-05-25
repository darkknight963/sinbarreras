import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(name: string, domain: string, vo: number, entityType: string): Promise<Project> {
    const project = this.projectRepository.create({ name, domain, vo, entityType });
    return this.projectRepository.save(project);
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepository.find({ relations: { scans: true } });
  }

  async findOne(id: string): Promise<Project | null> {
    return this.projectRepository.findOne({ where: { id }, relations: { scans: true } });
  }

  async update(id: string, updateData: Partial<Project>): Promise<Project> {
    await this.projectRepository.update(id, updateData);
    const updated = await this.findOne(id);
    if (!updated) throw new Error('Project not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.projectRepository.delete(id);
  }
}
