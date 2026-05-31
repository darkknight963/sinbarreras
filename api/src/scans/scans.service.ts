import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Scan } from './entities/scan.entity';
import { Project } from '../projects/entities/project.entity';
import { validateScanTargetUrls } from '../security/scan-url-policy';
import { CreateScanDto } from './dto/create-scan.dto';

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectQueue('scans')
    private readonly scansQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async triggerScan(createScanDto: CreateScanDto): Promise<Scan> {
    const { projectId, scanMode, ux } = createScanDto;
    const urls = await validateScanTargetUrls(createScanDto.urls);
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const vp = project.vo * ux;
    const normativeVersion = this.configService.get<string>('NORMATIVE_VERSION', 'Resolucion N° 001-2025-PCM/SGTD');
    const wcagVersion = this.configService.get<string>('WCAG_VERSION', 'WCAG 2.2');
    const ruleSetVersion = this.configService.get<string>('RULESET_VERSION', '2026-05');

    const scan = this.scanRepository.create({
      status: 'pending',
      scanMode,
      ux,
      vp,
      normativeVersion,
      wcagVersion,
      ruleSetVersion,
      project,
    });

    const savedScan = await this.scanRepository.save(scan);

    // Enqueue the scan job
    await this.scansQueue.add('process-scan', {
      scanId: savedScan.id,
      urls,
      scanMode,
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

  async remove(id: string): Promise<void> {
    await this.scanRepository.delete(id);
  }
}
