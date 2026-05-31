import { Controller, Post, Body, Get, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Scan } from '../scans/entities/scan.entity';
import { WCAG_CHECKLIST } from './wcag-checklist.data';

/**
 * Peruvian Compliance Controller
 * Implements:
 *  - Task 4.1: Vp Bulk Upload & Calculation
 *  - Task 4.2: .gob.pe Domain Validations
 *  - Task 4.3: Lengua de Señas Peruana flags
 */
@Controller('compliance')
export class ComplianceController {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
  ) {}

  /**
   * Task 4.1 — Bulk Upload Vo (Volumen de Visitas)
   * Accepts a JSON array of { domain, vo } objects and batch-updates
   * the corresponding projects. Then recalculates Vp for all their scans.
   *
   * POST /compliance/bulk-vp
   * Body: { entries: [{ domain: "www.munlima.gob.pe", vo: 6 }, ...] }
   */
  @Post('bulk-vp')
  async bulkUploadVp(
    @Body('entries') entries: Array<{ domain: string; vo: number }>,
  ) {
    const results: Array<{ domain: string; updated: boolean; vp?: number }> = [];

    for (const entry of entries) {
      const project = await this.projectRepository.findOne({
        where: { domain: entry.domain },
        relations: { scans: true },
      });

      if (!project) {
        results.push({ domain: entry.domain, updated: false });
        continue;
      }

      // Update project Vo
      project.vo = entry.vo;
      await this.projectRepository.save(project);

      // Recalculate Vp for all scans of this project
      if (project.scans) {
        for (const scan of project.scans) {
          scan.vp = entry.vo * scan.ux;
          await this.scanRepository.save(scan);
        }
      }

      const latestVp = project.scans?.length
        ? project.scans[project.scans.length - 1].vp
        : null;

      results.push({ domain: entry.domain, updated: true, vp: latestVp ?? undefined });
    }

    return {
      message: `Procesados ${entries.length} dominios`,
      results,
    };
  }

  /**
   * Task 4.1 — Single Vp Calculator
   * Returns the calculated Vp value and its priority category.
   *
   * POST /compliance/calculate-vp
   * Body: { vo: 6, ux: 6 }
   */
  @Post('calculate-vp')
  calculateVp(
    @Body('vo') vo: number,
    @Body('ux') ux: number,
  ) {
    const vp = vo * ux;

    let category: string;
    if (vp >= 24) category = 'Priorización Alta';
    else if (vp >= 12) category = 'Priorización Media';
    else category = 'Priorización Baja';

    return {
      vo,
      ux,
      vp,
      category,
      intervals: {
        'Priorización Baja': '4 – 8',
        'Priorización Media': '12 – 16',
        'Priorización Alta': '24 – 36',
      },
      formula: 'Vp = Vo × Ux (Artículo 7.3 de la Resolución N° 001-2025-PCM/SGTD)',
    };
  }

  /**
   * Task 4.2 — Domain Compliance Check
   * Detects .gob.pe domains and returns the applicable mandatory criteria.
   *
   * POST /compliance/check-domain
   * Body: { url: "https://www.munlima.gob.pe" }
   */
  @Post('check-domain')
  checkDomain(@Body('url') url: string) {
    const isGobPe = url.includes('.gob.pe');
    const isRegional = url.includes('regiongobierno') || url.includes('gore') || url.includes('gob.pe/region');
    const isLocal = url.includes('munic') || url.includes('munl') || url.includes('mun');

    const mandatoryCriteria: string[] = [];

    if (isGobPe) {
      // All Administración Pública criteria
      mandatoryCriteria.push(
        'WCAG 2.2 AA Compliance (Art. 6.2)',
        'Matriz de Priorización Vp = Vo × Ux (Art. 7.3)',
        'Declaración de Accesibilidad Digital publicada (Art. VIII)',
        'Canal de Contacto para quejas de accesibilidad (mesadeayuda@gobiernodigital.gob.pe)',
        'Verificación de materiales de apoyo: instructivos, videos tutoriales, asistente virtual, chat, pictogramas (Art. 7.5)',
        'Interpretación en Lengua de Señas Peruana para contenidos multimedia (Art. 7.4)',
      );
    }

    if (isRegional || isLocal) {
      mandatoryCriteria.push(
        'Integración de lenguas originarias: quechua, aimara y otras según región (Art. 7.4)',
      );
    }

    return {
      url,
      isGobPe,
      isRegionalOrLocal: isRegional || isLocal,
      entityTypeDetected: isGobPe
        ? (isLocal ? 'Gobierno Local' : isRegional ? 'Gobierno Regional' : 'Administración Pública Nacional')
        : 'Sector Privado',
      mandatoryCriteria,
      selloEligibility: {
        canApply: isGobPe,
        reference: 'Resolución N° 002-2024-PCM/SGTD — Sello de Accesibilidad Digital',
      },
    };
  }

  /**
   * Task 4.3 — Lengua de Señas Peruana Flags
   * Returns the heuristic flags/checks the worker should run for sign language.
   *
   * GET /compliance/sign-language-checks
   */
  @Get('sign-language-checks')
  getSignLanguageChecks() {
    return {
      criterion: '1.2.6',
      nameEs: 'Audio sincronizado con lengua de señas peruana (grabado)',
      level: 'AAA',
      resolution: 'Resolución N° 001-2025-PCM/SGTD — Artículo 7.4',
      law: 'Ley N° 29535 — Reconocimiento oficial de la lengua de señas peruana',
      verificationSteps: [
        'Detectar todos los elementos <video> y <iframe> (YouTube, Vimeo) en la página',
        'Verificar si existe un recuadro de intérprete de señas (PiP overlay o pista secundaria)',
        'Verificar si el video lleva metadato o título que indique "Lengua de Señas" o "LSP"',
        'Si no se puede determinar automáticamente, marcar como "Requiere verificación manual"',
      ],
      heuristicSelectors: [
        'video',
        'iframe[src*="youtube"]',
        'iframe[src*="vimeo"]',
        '[class*="sign-language"]',
        '[class*="lengua-senas"]',
        '[aria-label*="señas"]',
        '[aria-label*="sign language"]',
      ],
      automationLimit: 'La detección automática de un intérprete de señas dentro de un video es técnicamente limitada. El sistema marca estos elementos para revisión humana en el dashboard (Evaluación Semiautomática).',
    };
  }

  /**
   * Task 4.2 — Full WCAG 2.2 Criteria Checklist (86 criteria)
   * Returns the complete checklist following Anexo 1 of the Resolution.
   *
   * GET /compliance/wcag-checklist
   */
  @Get('wcag-checklist')
  getWcagChecklist() {
    return WCAG_CHECKLIST;
  }
}
