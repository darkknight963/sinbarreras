import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Scan } from './entities/scan.entity';
import { Project } from '../projects/entities/project.entity';

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectQueue('scans')
    private readonly scansQueue: Queue,
  ) {}

  async triggerScan(
    projectId: string,
    urls: string[],
    scanMode: string,
    ux: number,
    preNavigationScript?: string,
  ): Promise<Scan> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const vp = project.vo * ux;

    const scan = this.scanRepository.create({
      status: 'pending',
      scanMode,
      ux,
      vp,
      project,
    });

    const savedScan = await this.scanRepository.save(scan);

    // Enqueue the scan job
    await this.scansQueue.add('process-scan', {
      scanId: savedScan.id,
      urls,
      scanMode,
      preNavigationScript,
    });

    return savedScan;
  }

  async findAll(): Promise<Scan[]> {
    return this.scanRepository.find({ relations: { project: true, urlResults: true } });
  }

  async findOne(id: string): Promise<Scan | null> {
    return this.scanRepository.findOne({
      where: { id },
      relations: { project: true, urlResults: true },
    });
  }

  async update(id: string, updateData: Partial<Scan>): Promise<Scan> {
    await this.scanRepository.update(id, updateData);
    const updated = await this.findOne(id);
    if (!updated) throw new Error('Scan not found');
    return updated;
  }
}
