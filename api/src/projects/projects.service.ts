import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { Scan } from '../scans/entities/scan.entity';
import { UrlResult } from '../url-results/entities/url-result.entity';
import type { AccessScope } from '../auth/access-scope';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    @InjectRepository(UrlResult)
    private readonly urlResultRepository: Repository<UrlResult>,
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

  async findAll(
    ownerId: string | null,
    scope: AccessScope = { ownerId: null, includeAll: false },
  ): Promise<Project[]> {
    // Sin ownerId no hay contexto de usuario autenticado: devolver vacío en lugar
    // de exponer todos los proyectos de todos los clientes.
    if (!ownerId && !scope.includeAll) return [];

    // Solo cargamos campos ligeros de scans y urlResults para el listado.
    // Los campos jsonb pesados (violations, visualMap, etc.) se omiten aquí
    // y solo se cargan en findOne cuando el usuario abre un proyecto específico.
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoin('project.scans', 'scan')
      .leftJoin('scan.urlResults', 'urlResult')
      // Solo campos seguros del dueño — NUNCA passwordHash. leftJoinAndSelect
      // traía la fila completa del usuario y la exponía en la respuesta.
      .leftJoin('project.owner', 'owner')
      .addSelect(['owner.id', 'owner.email', 'owner.fullName', 'owner.companyName', 'owner.role'])
      .addSelect(['scan.id', 'scan.status', 'scan.globalScore', 'scan.scanMode', 'scan.createdAt', 'scan.scanUrls'])
      .addSelect(['urlResult.id', 'urlResult.url', 'urlResult.score', 'urlResult.status', 'urlResult.createdAt']);

    if (!scope.includeAll) {
      query.where('owner.id = :ownerId', { ownerId });
    }

    return query
      .orderBy('project.createdAt', 'DESC')
      .addOrderBy('scan.createdAt', 'DESC')
      .getMany();
  }

  async findOne(
    id: string,
    ownerId: string | null,
    scanLimit = 20,
    scope: AccessScope = { ownerId: null, includeAll: false },
  ): Promise<(Project & { hasMoreScans: boolean }) | null> {
    const safeLimit = Math.min(Math.max(1, scanLimit), 100);

    const projectQuery = this.projectRepository
      .createQueryBuilder('project')
      .leftJoin('project.owner', 'owner')
      .addSelect(['owner.id', 'owner.email', 'owner.fullName', 'owner.companyName', 'owner.role'])
      .where('project.id = :id', { id });

    if (!scope.includeAll && ownerId) {
      projectQuery.andWhere('owner.id = :ownerId', { ownerId });
    }

    const project = await projectQuery.getOne();
    if (!project) return null;

    // Load scans paginated (limit+1 to detect hasMore) — only lightweight fields,
    // no jsonb columns (violations, visualMap, etc.) which are only needed in the report view.
    const scanRows = await this.scanRepository
      .createQueryBuilder('scan')
      .leftJoin('scan.urlResults', 'urlResult')
      .addSelect(['urlResult.id', 'urlResult.url', 'urlResult.score', 'urlResult.status', 'urlResult.createdAt'])
      .where('scan.project = :projectId', { projectId: id })
      .orderBy('scan.createdAt', 'DESC')
      .take(safeLimit + 1)
      .getMany();

    const hasMoreScans = scanRows.length > safeLimit;
    project.scans = hasMoreScans ? scanRows.slice(0, safeLimit) : scanRows;

    return { ...project, hasMoreScans };
  }

  async update(
    id: string,
    updateData: Partial<Project>,
    ownerId: string | null,
    scope: AccessScope = { ownerId: null, includeAll: false },
  ): Promise<Project> {
    const existing = await this.findOne(id, ownerId, 20, scope);
    if (!existing) throw new Error('Project not found');
    await this.projectRepository.update(id, updateData);
    const updated = await this.findOne(id, ownerId, 20, scope);
    if (!updated) throw new Error('Project not found');
    return updated;
  }

  async remove(
    id: string,
    ownerId: string | null,
    scope: AccessScope = { ownerId: null, includeAll: false },
  ): Promise<void> {
    const project = await this.findOne(id, ownerId, 20, scope);
    if (!project) throw new Error('Project not found');
    await this.projectRepository.delete(id);
  }
}
