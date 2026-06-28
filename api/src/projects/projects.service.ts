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

  async create(name: string, domain: string, vo: number, entityType: string, ownerId: string | null): Promise<Project> {
    const project = this.projectRepository.create({
      name,
      domain,
      vo,
      entityType,
      owner: ownerId ? ({ id: ownerId } as Project['owner']) : null,
    });
    return this.projectRepository.save(project);
  }

  async findAll(ownerId: string | null): Promise<Project[]> {
    // Sin ownerId no hay contexto de usuario autenticado: devolver vacío en lugar
    // de exponer todos los proyectos de todos los clientes.
    if (!ownerId) return [];

    return this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.scans', 'scan')
      .leftJoinAndSelect('scan.urlResults', 'urlResult')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('owner.id = :ownerId', { ownerId })
      .orderBy('project.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string, ownerId: string | null): Promise<Project | null> {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.scans', 'scan')
      .leftJoinAndSelect('scan.urlResults', 'urlResult')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('project.id = :id', { id });

    if (ownerId) {
      query.andWhere('owner.id = :ownerId', { ownerId });
    }

    return query.getOne();
  }

  async update(id: string, updateData: Partial<Project>, ownerId: string | null): Promise<Project> {
    const existing = await this.findOne(id, ownerId);
    if (!existing) throw new Error('Project not found');
    await this.projectRepository.update(id, updateData);
    const updated = await this.findOne(id, ownerId);
    if (!updated) throw new Error('Project not found');
    return updated;
  }

  async remove(id: string, ownerId: string | null): Promise<void> {
    const project = await this.findOne(id, ownerId);
    if (!project) throw new Error('Project not found');
    await this.projectRepository.delete(id);
  }
}
