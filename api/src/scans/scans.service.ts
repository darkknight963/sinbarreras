import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Scan } from './entities/scan.entity';
import { Project } from '../projects/entities/project.entity';
import { UrlResult } from '../url-results/entities/url-result.entity';
import { validateScanTargetUrls } from '../security/scan-url-policy';
import { CreateScanDto } from './dto/create-scan.dto';
import { flattenWcagChecklist } from '../compliance/wcag-checklist.data';
import { RequestRateLimitService } from '../security/request-rate-limit.service';
import { EvidenceService } from '../evidence/evidence.service';

type TriggerScanOptions = {
  enforceSingleFreeUrl?: boolean;
  publicScan?: boolean;
};

type PublicScanRequest = {
  urls?: string[];
  url?: string;
  scanMode?: string;
  ux?: number;
  entityType?: string;
};

type ScanWithProgress = Scan & {
  progress?: number;
};

type ExtensionAuditResult = {
  url?: string;
  score?: number;
  violations?: unknown[];
  manualVerifications?: unknown[];
  contentDetection?: unknown;
  applicability?: unknown;
  engineReport?: unknown;
  focusTraversal?: unknown;
  semanticStructure?: unknown;
  visualMap?: unknown;
};

type ExtensionFindingLike = {
  criterion?: unknown;
  wcagCriterion?: unknown;
  findingStatus?: unknown;
  status?: unknown;
};

type ExtensionContentDetection = {
  tiene_imagenes: boolean;
  tiene_svg_funcional: boolean;
  tiene_video: boolean;
  tiene_audio: boolean;
  tiene_audio_autoplay: boolean;
  tiene_formularios: boolean;
  tiene_inputs_texto: boolean;
  tiene_select: boolean;
  tiene_checkboxes_radios: boolean;
  tiene_autenticacion: boolean;
  tiene_captcha: boolean;
  tiene_enlaces: boolean;
  tiene_tablas: boolean;
  tiene_encabezados: boolean;
  tiene_iframes: boolean;
  tiene_drag_and_drop: boolean;
  tiene_animaciones_css: boolean;
  tiene_movimiento_automatico: boolean;
  tiene_contenido_hover: boolean;
  tiene_timeout_sesion: boolean;
  tiene_mensajes_estado: boolean;
  tiene_contenido_multipagina: boolean;
  tiene_proceso_multipaso: boolean;
  tiene_transacciones: boolean;
  tiene_imagenes_de_texto: boolean;
  tiene_ayuda: boolean;
  es_dominio_gob_pe: boolean;
};

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(UrlResult)
    private readonly urlResultRepository: Repository<UrlResult>,
    @InjectQueue('scans')
    private readonly scansQueue: Queue,
    private readonly configService: ConfigService,
    private readonly rateLimitService: RequestRateLimitService,
    private readonly dataSource: DataSource,
    private readonly evidenceService: EvidenceService,
  ) {}

  private canonicalizePlanUrl(value: string): string {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();

    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  }

  private async getFreeReservedUrls(ownerId: string): Promise<Set<string>> {
    const projects = await this.projectRepository
      .createQueryBuilder('project')
      .leftJoin('project.owner', 'owner')
      .select('project.domain', 'domain')
      .where('owner.id = :ownerId', { ownerId })
      .andWhere('project.domain IS NOT NULL')
      .getRawMany<{ domain: string | null }>();

    const results = await this.urlResultRepository
      .createQueryBuilder('urlResult')
      .innerJoin('urlResult.scan', 'scan')
      .innerJoin('scan.project', 'project')
      .innerJoin('project.owner', 'owner')
      .select('urlResult.url', 'url')
      .where('owner.id = :ownerId', { ownerId })
      .getRawMany<{ url: string | null }>();

    const reservedUrls = new Set<string>();
    for (const value of [...projects.map((project) => project.domain), ...results.map((result) => result.url)]) {
      if (!value) continue;
      try {
        reservedUrls.add(this.canonicalizePlanUrl(value));
      } catch {
        continue;
      }
    }

    return reservedUrls;
  }

  async cancelScan(id: string, ownerId: string | null): Promise<Scan> {
    const scan = await this.scanRepository
      .createQueryBuilder('scan')
      .leftJoinAndSelect('scan.project', 'project')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('scan.id = :id', { id })
      .getOne();

    if (!scan) {
      throw new NotFoundException('Escaneo no encontrado.');
    }

    const projectOwnerId = scan.project?.owner?.id ?? null;
    const isPublic = !projectOwnerId;

    if (!isPublic && projectOwnerId !== ownerId) {
      throw new ForbiddenException('No tienes permiso para cancelar este escaneo.');
    }

    if (!['pending', 'running', 'awaiting_login'].includes(scan.status)) {
      throw new BadRequestException('Solo se pueden cancelar escaneos en cola o en ejecución.');
    }

    scan.status = 'cancelled';
    const saved = await this.scanRepository.save(scan);
    await this.invalidateScanCache(id);
    return saved;
  }

  private async enforceSingleFreeUrl(ownerId: string, project: Project, urls: string[]): Promise<void> {
    if (urls.length > 1) {
      throw new ForbiddenException('El plan Free permite solo 1 URL por escaneo.');
    }

    const requestedUrl = this.canonicalizePlanUrl(urls[0]);

    // Distributed lock prevents two concurrent Free-plan scans from both passing
    // the "no reserved URL yet" check and then writing different domains.
    const lockKey = `free-url-lock:${ownerId}`;
    const acquired = await this.rateLimitService.setOnce(lockKey, 10_000);
    if (!acquired) {
      throw new ForbiddenException('Otro escaneo está en proceso. Por favor espera un momento.');
    }

    try {
      const reservedUrls = await this.getFreeReservedUrls(ownerId);
      const existingDifferentUrl = [...reservedUrls].find((url) => url !== requestedUrl);

      if (existingDifferentUrl) {
        throw new ForbiddenException(
          'Tu plan Free incluye una URL guardada. Puedes reescanear esa misma URL; sube a Pro para auditar más sitios o páginas.',
        );
      }

      if (!project.domain) {
        await this.projectRepository.update(project.id, { domain: requestedUrl });
        project.domain = requestedUrl;
      }
    } finally {
      await this.rateLimitService.deleteKey(lockKey);
    }
  }

  private getSpecificCriterion(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^\d+\.\d+\.\d+$/.test(trimmed) ? trimmed : null;
  }

  private getFindingCriterion(finding: ExtensionFindingLike): string | null {
    return this.getSpecificCriterion(finding.criterion) || this.getSpecificCriterion(finding.wcagCriterion);
  }

  private normalizeExtensionContentDetection(value: unknown): ExtensionContentDetection | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Record<string, unknown>;
    const keys: Array<keyof ExtensionContentDetection> = [
      'tiene_imagenes',
      'tiene_svg_funcional',
      'tiene_video',
      'tiene_audio',
      'tiene_audio_autoplay',
      'tiene_formularios',
      'tiene_inputs_texto',
      'tiene_select',
      'tiene_checkboxes_radios',
      'tiene_autenticacion',
      'tiene_captcha',
      'tiene_enlaces',
      'tiene_tablas',
      'tiene_encabezados',
      'tiene_iframes',
      'tiene_drag_and_drop',
      'tiene_animaciones_css',
      'tiene_movimiento_automatico',
      'tiene_contenido_hover',
      'tiene_timeout_sesion',
      'tiene_mensajes_estado',
      'tiene_contenido_multipagina',
      'tiene_proceso_multipaso',
      'tiene_transacciones',
      'tiene_imagenes_de_texto',
      'tiene_ayuda',
      'es_dominio_gob_pe',
    ];
    return keys.reduce((acc, key) => {
      acc[key] = Boolean(source[key]);
      return acc;
    }, {} as ExtensionContentDetection);
  }

  private extensionCriterionApplies(id: string, d: ExtensionContentDetection): boolean {
    switch (id) {
      case '1.1.1': return d.tiene_imagenes || d.tiene_svg_funcional || d.tiene_video || d.tiene_audio;
      case '1.2.1':
      case '1.2.2':
      case '1.2.3':
      case '1.2.5':
      case '1.2.6':
      case '1.2.7':
      case '1.2.8': return d.tiene_video || d.tiene_audio;
      case '1.2.4': return d.tiene_video || d.tiene_audio;
      case '1.2.9': return d.tiene_audio;
      case '1.3.5': return d.tiene_formularios;
      case '1.4.2': return d.tiene_audio_autoplay;
      case '1.4.5':
      case '1.4.9': return d.tiene_imagenes_de_texto;
      case '1.4.7': return d.tiene_audio || d.tiene_video;
      case '1.4.8': return true;
      case '1.4.11': return d.tiene_formularios || d.tiene_svg_funcional;
      case '1.4.13': return d.tiene_contenido_hover;
      case '2.1.4': return false;
      case '2.2.1':
      case '2.2.3':
      case '2.2.6': return d.tiene_timeout_sesion;
      case '2.2.2': return d.tiene_movimiento_automatico;
      case '2.2.4': return d.tiene_mensajes_estado;
      case '2.2.5': return d.tiene_autenticacion;
      case '2.3.1':
      case '2.3.2':
      case '2.3.3': return d.tiene_animaciones_css;
      case '2.4.4':
      case '2.4.9': return d.tiene_enlaces;
      case '2.4.5':
      case '2.4.8': return d.tiene_contenido_multipagina;
      case '2.4.6': return d.tiene_encabezados || d.tiene_formularios;
      case '2.4.10': return d.tiene_encabezados;
      case '2.5.1': return d.tiene_drag_and_drop;
      case '2.5.2':
      case '2.5.3':
      case '2.5.5':
      case '2.5.8': return d.tiene_enlaces || d.tiene_formularios;
      case '2.5.4': return false;
      case '2.5.7': return d.tiene_drag_and_drop;
      case '3.1.2':
      case '3.1.3':
      case '3.1.4':
      case '3.1.6': return false;
      case '3.1.5': return true;
      case '3.2.2': return d.tiene_select || d.tiene_checkboxes_radios || d.tiene_formularios;
      case '3.2.3':
      case '3.2.4': return d.tiene_contenido_multipagina;
      case '3.2.6': return d.tiene_ayuda;
      case '3.3.1':
      case '3.3.2':
      case '3.3.3':
      case '3.3.5':
      case '3.3.6': return d.tiene_formularios;
      case '3.3.4': return d.tiene_transacciones;
      case '3.3.7': return d.tiene_proceso_multipaso;
      case '3.3.8':
      case '3.3.9': return d.tiene_autenticacion || d.tiene_captcha;
      case '4.1.3': return d.tiene_mensajes_estado;
      default: return true;
    }
  }

  private extensionApplicabilityReason(id: string, applies: boolean): string {
    if (applies) {
      return 'Aplica segun el contenido detectado en la pestana autenticada.';
    }
    const reasons: Record<string, string> = {
      '1.1.1': 'No se detectaron imagenes, SVG funcional, audio, video, canvas ni contenido no textual relevante.',
      '1.2.1': 'No se detecto audio o video.',
      '1.2.2': 'No se detecto audio o video.',
      '1.2.3': 'No se detecto video.',
      '1.2.4': 'No se detecto audio o video en vivo.',
      '1.2.5': 'No se detecto video.',
      '1.2.6': 'No se detecto audio o video.',
      '1.2.7': 'No se detecto video.',
      '1.2.8': 'No se detecto audio o video.',
      '1.2.9': 'No se detecto audio en vivo.',
      '1.3.5': 'No se detectaron controles de entrada.',
      '1.4.2': 'No se detecto audio o video con reproduccion automatica.',
      '1.4.5': 'No se detectaron imagenes de texto.',
      '1.4.7': 'No se detecto audio o video.',
      '1.4.9': 'No se detectaron imagenes de texto.',
      '1.4.11': 'No se detectaron controles, iconos funcionales o graficos relevantes.',
      '1.4.13': 'No se detecto contenido activado por hover o foco.',
      '2.1.4': 'No se detectaron atajos de teclado personalizados.',
      '2.2.1': 'No se detectaron limites de tiempo.',
      '2.2.2': 'No se detecto contenido en movimiento automatico.',
      '2.2.3': 'No se detectaron limites de tiempo.',
      '2.2.4': 'No se detectaron interrupciones o mensajes dinamicos.',
      '2.2.5': 'No se detecto reautenticacion.',
      '2.2.6': 'No se detectaron tiempos de espera.',
      '2.3.1': 'No se detectaron animaciones o destellos.',
      '2.3.2': 'No se detectaron animaciones o destellos.',
      '2.3.3': 'No se detectaron animaciones activadas por interaccion.',
      '2.4.4': 'No se detectaron enlaces.',
      '2.4.5': 'No se detecto estructura multipagina.',
      '2.4.6': 'No se detectaron encabezados ni formularios.',
      '2.4.8': 'No se detecto estructura multipagina.',
      '2.4.9': 'No se detectaron enlaces.',
      '2.4.10': 'No se detectaron encabezados.',
      '2.5.1': 'No se detectaron gestos o trayectorias.',
      '2.5.4': 'No se detecto funcionalidad por movimiento del dispositivo.',
      '2.5.7': 'No se detecto drag and drop.',
      '3.1.2': 'No se detectaron partes con idioma distinto.',
      '3.1.3': 'No se detectaron terminos inusuales marcados.',
      '3.1.4': 'No se detectaron abreviaturas marcadas.',
      '3.1.6': 'No se detecto contenido que requiera pronunciacion especial.',
      '3.2.3': 'No se detecto estructura multipagina.',
      '3.2.4': 'No se detecto estructura multipagina.',
      '3.2.6': 'No se detecto mecanismo de ayuda.',
      '3.3.1': 'No se detectaron formularios.',
      '3.3.2': 'No se detectaron formularios.',
      '3.3.3': 'No se detectaron formularios con validacion.',
      '3.3.4': 'No se detectaron transacciones legales, financieras o datos privados.',
      '3.3.5': 'No se detectaron formularios.',
      '3.3.6': 'No se detectaron formularios con envio de datos.',
      '3.3.7': 'No se detecto proceso multipaso.',
      '3.3.8': 'No se detecto autenticacion ni captcha.',
      '3.3.9': 'No se detecto autenticacion ni captcha.',
      '4.1.3': 'No se detectaron mensajes de estado dinamicos.',
    };
    return reasons[id] || 'No se detecto condicion de aplicabilidad para este criterio.';
  }

  private buildExtensionApplicability(
    violations: unknown[],
    manualVerifications: unknown[],
    score: number,
    contentDetection?: ExtensionContentDetection | null,
    existingSummary?: Record<string, unknown> | null,
  ) {
    const failedCriterionIds = new Set<string>();
    const reviewCriterionIds = new Set<string>();

    for (const finding of violations as ExtensionFindingLike[]) {
      const criterion = this.getFindingCriterion(finding);
      if (!criterion) continue;
      const status = String(finding.findingStatus || finding.status || 'confirmed');
      if (status === 'needs_review' || status === 'not_evaluated') {
        reviewCriterionIds.add(criterion);
      } else if (status !== 'not_applicable') {
        failedCriterionIds.add(criterion);
      }
    }

    for (const finding of manualVerifications as ExtensionFindingLike[]) {
      const criterion = this.getFindingCriterion(finding);
      if (!criterion || failedCriterionIds.has(criterion)) continue;
      const status = String(finding.findingStatus || finding.status || 'needs_review');
      if (status === 'confirmed' || status === 'failed') {
        failedCriterionIds.add(criterion);
        reviewCriterionIds.delete(criterion);
      } else if (status !== 'not_applicable') {
        reviewCriterionIds.add(criterion);
      }
    }

    const criteria = flattenWcagChecklist().map((criterion) => {
      const isEvidenceCriterion = failedCriterionIds.has(criterion.criterionId) || reviewCriterionIds.has(criterion.criterionId);
      const applies = contentDetection
        ? isEvidenceCriterion || this.extensionCriterionApplies(criterion.criterionId, contentDetection)
        : true;
      return {
        id: criterion.criterionId,
        nombre: criterion.criterionName,
        nivel: criterion.level,
        estado: applies ? 'aplica' : 'no_aplica',
        razon: contentDetection
          ? this.extensionApplicabilityReason(criterion.criterionId, applies)
          : 'Detector de contenido no disponible; se aplica comportamiento conservador hasta ajuste manual del auditor.',
      };
    });

    const totalCriteria = criteria.length;
    const applicableCriterionIds = new Set(criteria.filter((criterion) => criterion.estado === 'aplica').map((criterion) => criterion.id));
    const applicableCount = applicableCriterionIds.size;
    const failedCount = [...failedCriterionIds].filter((criterionId) => applicableCriterionIds.has(criterionId)).length;
    const reviewCount = [...reviewCriterionIds].filter((criterionId) => applicableCriterionIds.has(criterionId) && !failedCriterionIds.has(criterionId)).length;
    const passedCount = Math.max(0, applicableCount - failedCount - reviewCount);

    return {
      criteria,
      summary: {
        ...(existingSummary || {}),
        totalCriteria,
        applicableCount,
        notApplicableCount: totalCriteria - applicableCount,
        failedCount,
        reviewCount,
        passedCount,
        score,
      },
    };
  }

  private normalizeExtensionApplicability(payload: ExtensionAuditResult, score: number) {
    const applicability = payload.applicability as { criteria?: unknown[]; summary?: Record<string, unknown> } | null | undefined;
    if (Array.isArray(applicability?.criteria) && applicability.criteria.length > 0) {
      return applicability;
    }

    const violations = Array.isArray(payload.violations) ? payload.violations : [];
    const manualVerifications = Array.isArray(payload.manualVerifications) ? payload.manualVerifications : [];
    const contentDetection = this.normalizeExtensionContentDetection(payload.contentDetection);
    return this.buildExtensionApplicability(violations, manualVerifications, score, contentDetection, applicability?.summary || null);
  }

  private async repairExtensionApplicability(scan: Scan | null): Promise<Scan | null> {
    if (!scan?.urlResults?.length) return scan;

    const toRepair: UrlResult[] = [];

    for (const result of scan.urlResults) {
      const hasCriteria = Array.isArray(result.applicability?.criteria) && result.applicability.criteria.length > 0;
      const hasExtensionEvidence =
        scan.loginMode === 'manual_assisted' ||
        (Array.isArray(result.engineReport) && result.engineReport.some((entry: any) => String(entry?.engine || '').includes('extension')));

      if (hasCriteria || !hasExtensionEvidence) continue;

      const score = Number.isFinite(Number(result.score)) ? Math.max(0, Math.min(100, Math.round(Number(result.score)))) : 100;
      result.applicability = this.buildExtensionApplicability(
        Array.isArray(result.violations) ? result.violations : [],
        Array.isArray(result.manualVerifications) ? result.manualVerifications : [],
        score,
        null,
        result.applicability?.summary || null,
      );
      toRepair.push(result);
    }

    if (toRepair.length === 0) return scan;

    await this.urlResultRepository.save(toRepair);

    const scores = scan.urlResults
      .map((result) => result.score)
      .filter((resultScore): resultScore is number => typeof resultScore === 'number');
    scan.globalScore = scores.length > 0
      ? Math.round(scores.reduce((sum, resultScore) => sum + resultScore, 0) / scores.length)
      : scan.globalScore;
    await this.scanRepository.save(scan);

    return scan;
  }

  private async attachQueueProgress(scan: Scan | null): Promise<ScanWithProgress | null> {
    if (!scan) return null;

    // Progress is animated client-side; we never query Redis (getJob) here anymore.
    // Only completed scans report a real 100; everything else is 0 and the frontend
    // shows a simulated progress bar based on elapsed time. This keeps Upstash usage
    // near zero during status polling.
    const scanWithProgress = scan as ScanWithProgress;
    scanWithProgress.progress = scan.status === 'completed' ? 100 : 0;
    return scanWithProgress;
  }

  async triggerScan(createScanDto: CreateScanDto, ownerId: string | null, options: TriggerScanOptions = {}): Promise<ScanWithProgress> {
    const { projectId, scanMode, ux } = createScanDto;
    const loginMode = createScanDto.loginMode || 'none';
    const urls = await validateScanTargetUrls(createScanDto.urls);
    const projectQuery = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('project.id = :projectId', { projectId });

    if (ownerId) {
      projectQuery.andWhere('owner.id = :ownerId', { ownerId });
    }

    const project = await projectQuery.getOne();
    if (!project) throw new Error('Project not found');

    if (ownerId && options.enforceSingleFreeUrl) {
      await this.enforceSingleFreeUrl(ownerId, project, urls);
    }

    const vp = project.vo * ux;
    const normativeVersion = this.configService.get<string>('NORMATIVE_VERSION', 'Resolucion N° 001-2025-PCM/SGTD');
    const wcagVersion = this.configService.get<string>('WCAG_VERSION', 'WCAG 2.2');
    const ruleSetVersion = this.configService.get<string>('RULESET_VERSION', '2026-05');

    const scan = this.scanRepository.create({
      ...(createScanDto.id ? { id: createScanDto.id } : {}),
      status: loginMode === 'manual_assisted' ? 'awaiting_login' : 'pending',
      scanMode,
      loginMode,
      scanUrls: urls,
      ux,
      vp,
      normativeVersion,
      wcagVersion,
      ruleSetVersion,
      project,
    });

    const savedScan = await this.scanRepository.save(scan);

    if (loginMode !== 'manual_assisted') {
      // Backpressure: si la cola tiene demasiados jobs pendientes, rechazar con 503
      // en lugar de acumular jobs que esperarían horas. El umbral es configurable.
      const QUEUE_MAX_PENDING = Number(process.env.QUEUE_MAX_PENDING || 50);
      const [waiting, delayed] = await Promise.all([
        this.scansQueue.getWaitingCount(),
        this.scansQueue.getDelayedCount(),
      ]);
      const pendingTotal = waiting + delayed;
      if (pendingTotal >= QUEUE_MAX_PENDING) {
        // Marcar el scan como fallido antes de rechazar para no dejar registros huérfanos.
        await this.scanRepository.update(savedScan.id, { status: 'failed' });
        throw new ServiceUnavailableException(
          `El servicio está procesando muchos escaneos en este momento (${pendingTotal} en cola). ` +
          `Por favor intenta en unos minutos.`,
        );
      }

      await this.scansQueue.add(
        'process-scan',
        {
          scanId: savedScan.id,
          urls,
          scanMode,
          loginMode,
          publicScan: options.publicScan === true,
        },
        {
          jobId: savedScan.id,
          // Borrar inmediatamente al completar: el estado de verdad está en Postgres,
          // no en Redis. Mantener jobs en Redis solo infla el consumo de memoria.
          // En fallo conservamos los últimos 20 para poder diagnosticar sin sobrecargar.
          removeOnComplete: true,
          removeOnFail: { count: 20 },
        },
      );
    }

    return this.attachQueueProgress(savedScan) as Promise<ScanWithProgress>;
  }

  async triggerPublicScan(scanRequest: PublicScanRequest): Promise<ScanWithProgress> {
    const urls = await validateScanTargetUrls(scanRequest.urls || (scanRequest.url ? [scanRequest.url] : []), { maxUrls: 1 });
    const canonicalUrl = this.canonicalizePlanUrl(urls[0]);
    const project = await this.projectRepository.save(this.projectRepository.create({
      name: 'Análisis gratuito',
      domain: canonicalUrl,
      vo: 4,
      entityType: scanRequest.entityType === 'Administración Pública Peruana' ? 'Administración Pública Peruana' : 'Sector privado',
      owner: null,
    }));

    const ALLOWED_PUBLIC_SCAN_MODES = ['estándar', 'standard', 'rapido', 'rápido'];
    const scanMode = ALLOWED_PUBLIC_SCAN_MODES.includes(String(scanRequest.scanMode || ''))
      ? scanRequest.scanMode!
      : 'estándar';
    const ux = Number.isInteger(scanRequest.ux) && (scanRequest.ux as number) >= 1 && (scanRequest.ux as number) <= 5
      ? scanRequest.ux as number
      : 4;

    return this.triggerScan({
      projectId: project.id,
      urls,
      scanMode,
      ux,
    }, null, { publicScan: true });
  }

  async findAll(
    ownerId: string | null,
    limit = 20,
    before?: string,
    projectId?: string,
  ): Promise<{ scans: Scan[]; hasMore: boolean }> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const query = this.scanRepository
      .createQueryBuilder('scan')
      .leftJoinAndSelect('scan.project', 'project')
      .leftJoinAndSelect('project.owner', 'owner')
      .leftJoin('scan.urlResults', 'urlResult')
      .addSelect(['urlResult.id', 'urlResult.url', 'urlResult.score', 'urlResult.status'])
      .orderBy('scan.createdAt', 'DESC')
      .take(safeLimit + 1);

    if (ownerId) {
      query.where('owner.id = :ownerId', { ownerId });
    }

    if (projectId) {
      query.andWhere('project.id = :projectId', { projectId });
    }

    if (before) {
      query.andWhere('scan.createdAt < :before', { before: new Date(before) });
    }

    const rows = await query.getMany();
    const hasMore = rows.length > safeLimit;
    return { scans: hasMore ? rows.slice(0, safeLimit) : rows, hasMore };
  }

  // Scans terminales no se cachean: son inmutables y Postgres es la fuente de verdad.
  // Cachear el objeto completo (con violations, visualMap, focusTraversal jsonb) duplicaría
  // MBs en Redis sin beneficio real — el frontend solo re-consulta un scan terminal
  // cuando recarga la página, no en un loop de polling.
  // Scans activos se cachean 8s para absorber el polling sin saturar Postgres.
  private getScanCacheTtlMs(status: string): number {
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      return 0; // no cachear — Postgres sirve la respuesta directamente
    }
    return 8 * 1000; // 8 s — polling absorber sin staleness perceptible
  }

  private scanCacheKey(id: string, ownerId: string | null): string {
    return `scan:cache:${id}:${ownerId ?? 'public'}`;
  }

  async invalidateScanCache(id: string): Promise<void> {
    // Borra todas las variantes de caché para este scan: pública y por owner.
    // El worker llama esto al completar o fallar un scan.
    const pattern = `scan:cache:${id}:*`;
    try {
      const keys = await this.rateLimitService.scanKeys(pattern);
      if (keys.length) {
        await Promise.all(keys.map((k) => this.rateLimitService.deleteKey(k)));
      }
    } catch {
      // No fatal: la caché expirará sola en max 8s
    }
  }

  private isTerminalStatus(status: string): boolean {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
  }

  // Scans activos: solo campos ligeros para el polling del frontend (status, progreso, score).
  // Los jsonb pesados (violations, visualMap, focusTraversal, semanticStructure) se cargan
  // solo cuando el scan está terminal y el usuario abre el reporte completo.
  private buildScanQuery(id: string, includeHeavyFields: boolean) {
    const query = this.scanRepository
      .createQueryBuilder('scan')
      .leftJoinAndSelect('scan.project', 'project')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('scan.id = :id', { id });

    if (includeHeavyFields) {
      query.leftJoinAndSelect('scan.urlResults', 'urlResult');
    } else {
      query
        .leftJoin('scan.urlResults', 'urlResult')
        .addSelect(['urlResult.id', 'urlResult.url', 'urlResult.score', 'urlResult.status', 'urlResult.createdAt']);
    }
    return query;
  }

  async findOne(id: string, ownerId: string | null): Promise<ScanWithProgress | null> {
    const cacheKey = this.scanCacheKey(id, ownerId);
    const cached = await this.rateLimitService.getJson<ScanWithProgress>(cacheKey);
    if (cached !== null) return cached;

    // Primera pasada ligera para saber el status sin cargar jsonb
    const statusCheck = await this.scanRepository
      .createQueryBuilder('scan')
      .leftJoin('scan.project', 'project')
      .leftJoin('project.owner', 'owner')
      .select(['scan.id', 'scan.status'])
      .where('scan.id = :id', { id })
      .andWhere(ownerId ? 'owner.id = :ownerId' : '1=1', ownerId ? { ownerId } : {})
      .getOne();

    if (!statusCheck) return null;
    const heavy = this.isTerminalStatus(statusCheck.status);

    const query = this.buildScanQuery(id, heavy);
    if (ownerId) query.andWhere('owner.id = :ownerId', { ownerId });

    const result = await this.attachQueueProgress(await this.repairExtensionApplicability(await query.getOne()));
    if (result) {
      const ttl = this.getScanCacheTtlMs(result.status);
      if (ttl > 0) {
        await this.rateLimitService.setJson(cacheKey, result, ttl).catch(() => {/* non-fatal */});
      }
    }
    return result;
  }

  async findPublicOne(id: string): Promise<ScanWithProgress | null> {
    const cacheKey = this.scanCacheKey(id, null);
    const cached = await this.rateLimitService.getJson<ScanWithProgress>(cacheKey);
    if (cached !== null) return cached;

    // Primera pasada ligera para saber el status
    const statusCheck = await this.scanRepository
      .createQueryBuilder('scan')
      .leftJoin('scan.project', 'project')
      .leftJoin('project.owner', 'owner')
      .select(['scan.id', 'scan.status'])
      .where('scan.id = :id', { id })
      .andWhere('owner.id IS NULL')
      .getOne();

    if (!statusCheck) return null;
    const heavy = this.isTerminalStatus(statusCheck.status);

    const query = this.buildScanQuery(id, heavy);
    query.andWhere('owner.id IS NULL');

    const result = await this.attachQueueProgress(await this.repairExtensionApplicability(await query.getOne()));
    if (result) {
      const ttl = this.getScanCacheTtlMs(result.status);
      if (ttl > 0) {
        await this.rateLimitService.setJson(cacheKey, result, ttl).catch(() => {/* non-fatal */});
      }
    }
    return result;
  }

  async submitExtensionResult(id: string, ownerId: string | null, payload: ExtensionAuditResult): Promise<ScanWithProgress> {
    const scan = await this.findOne(id, ownerId);
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    if (!payload?.url) {
      throw new BadRequestException('Debe proporcionar la URL auditada por la extension.');
    }

    const [url] = await validateScanTargetUrls([payload.url], { maxUrls: 1 });
    if (scan.status !== 'awaiting_login') {
      throw new BadRequestException('Este escaneo ya fue procesado o no está esperando resultados de la extensión.');
    }

    // Atomic status transition prevents two concurrent extension submissions from
    // both passing the awaiting_login check and writing duplicate urlResults.
    const transitioned = await this.scanRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'running' })
      .where('id = :id AND status = :expected', { id: scan.id, expected: 'awaiting_login' })
      .execute();

    if (!transitioned.affected || transitioned.affected === 0) {
      throw new BadRequestException('Este escaneo ya fue procesado o no está esperando resultados de la extensión.');
    }

    if (scan.urlResults?.length) {
      throw new BadRequestException('Este escaneo ya tiene resultados y no puede sobrescribirse.');
    }

    const violations = Array.isArray(payload.violations) ? payload.violations : [];
    const manualVerifications = Array.isArray(payload.manualVerifications) ? payload.manualVerifications : [];
    const score = Number.isFinite(Number(payload.score))
      ? Math.max(0, Math.min(100, Math.round(Number(payload.score))))
      : Math.max(0, 100 - violations.length * 4 - manualVerifications.length);

    try {
      await this.dataSource.transaction(async (manager) => {
        const urlResult = manager.create(UrlResult, {
          url,
          score,
          violations,
          manualVerifications,
          applicability: this.normalizeExtensionApplicability(payload, score),
          engineReport: payload.engineReport ?? null,
          focusTraversal: payload.focusTraversal ?? null,
          semanticStructure: payload.semanticStructure ?? null,
          visualMap: payload.visualMap ?? null,
          peruvianChecks: (payload as any).peruvianChecks ?? null,
          status: 'completed',
          scan,
        });
        await manager.save(UrlResult, urlResult);
        await manager.update(Scan, scan.id, {
          status: 'completed',
          globalScore: score,
          scanUrls: [url],
        });
      });
    } catch (err) {
      // Rollback the status to awaiting_login so the user can retry submission.
      await this.scanRepository.update(scan.id, { status: 'awaiting_login' });
      throw err;
    }

    await this.invalidateScanCache(scan.id);
    const updated = await this.findOne(scan.id, ownerId);
    if (!updated) {
      throw new NotFoundException('Scan not found');
    }

    return updated;
  }

  async update(id: string, updateData: Partial<Scan>, ownerId: string | null): Promise<Scan> {
    const existing = await this.findOne(id, ownerId);
    if (!existing) throw new Error('Scan not found');
    await this.scanRepository.update(id, updateData);
    await this.invalidateScanCache(id);
    const updated = await this.findOne(id, ownerId);
    if (!updated) throw new Error('Scan not found');
    return updated;
  }

  async remove(id: string, ownerId: string | null): Promise<void> {
    const scan = await this.findOne(id, ownerId);
    if (!scan) throw new Error('Scan not found');

    // Load full urlResults to extract R2 evidence URLs before row deletion
    const fullUrlResults = await this.urlResultRepository.find({
      where: { scan: { id } },
      select: { id: true, violations: true, visualMap: true, focusTraversal: true },
    });

    await this.invalidateScanCache(id);
    await this.scanRepository.delete(id);

    // Best-effort R2 cleanup — never fail scan deletion due to storage errors
    this.evidenceService.deleteEvidenceForScan(fullUrlResults).catch((err) =>
      console.error(`R2 cleanup failed for scan ${id}:`, err),
    );
  }
}
