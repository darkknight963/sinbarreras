import { Controller, Post, Body, Get, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Scan } from '../scans/entities/scan.entity';

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
    return {
      standard: 'WCAG 2.2',
      resolution: 'Resolución N° 001-2025-PCM/SGTD — Anexo 1',
      totalCriteria: 86,
      principles: [
        {
          id: 1,
          name: 'Perceptible',
          criteria: [
            { id: '1.1.1', name: 'Contenido no textual', level: 'A' },
            { id: '1.2.1', name: 'Solo audio y solo vídeo (pregrabado)', level: 'A' },
            { id: '1.2.2', name: 'Audio sincronizado con subtítulos (grabado)', level: 'A' },
            { id: '1.2.3', name: 'Vídeo con audiodescripción o medio alternativo (grabado)', level: 'A' },
            { id: '1.3.1', name: 'Información y relaciones', level: 'A' },
            { id: '1.3.2', name: 'Secuencia significativa', level: 'A' },
            { id: '1.3.3', name: 'Características sensoriales', level: 'A' },
            { id: '1.4.1', name: 'Uso del color', level: 'A' },
            { id: '1.4.2', name: 'Control del sonido', level: 'A' },
            { id: '1.2.4', name: 'Audio sincronizado con subtítulos (en directo)', level: 'AA' },
            { id: '1.2.5', name: 'Vídeo con audiodescripción (grabado)', level: 'AA' },
            { id: '1.3.4', name: 'Orientación de la pantalla', level: 'AA' },
            { id: '1.3.5', name: 'Identificación del propósito del campo', level: 'AA' },
            { id: '1.4.3', name: 'Contraste mínimo', level: 'AA' },
            { id: '1.4.4', name: 'Cambio de tamaño del texto', level: 'AA' },
            { id: '1.4.5', name: 'Imágenes de texto', level: 'AA' },
            { id: '1.4.10', name: 'Reajuste de elementos (Reflow)', level: 'AA' },
            { id: '1.4.11', name: 'Contraste no textual', level: 'AA' },
            { id: '1.4.12', name: 'Espaciado del texto', level: 'AA' },
            { id: '1.4.13', name: 'Contenido al pasar el cursor o al recibir foco', level: 'AA' },
            { id: '1.2.6', name: 'Audio sincronizado con lengua de señas peruana (grabado)', level: 'AAA' },
            { id: '1.2.7', name: 'Vídeo con audiodescripción ampliada (grabado)', level: 'AAA' },
            { id: '1.2.8', name: 'Vídeo o medio sincronizado con medio alternativo (grabado)', level: 'AAA' },
            { id: '1.2.9', name: 'Audio solo (en directo)', level: 'AAA' },
            { id: '1.3.6', name: 'Identificación del propósito', level: 'AAA' },
            { id: '1.4.6', name: 'Contraste mejorado', level: 'AAA' },
            { id: '1.4.7', name: 'Sonido de fondo bajo o ausente', level: 'AAA' },
            { id: '1.4.8', name: 'Presentación visual', level: 'AAA' },
            { id: '1.4.9', name: 'Imágenes de texto (sin excepciones)', level: 'AAA' },
          ],
        },
        {
          id: 2,
          name: 'Operable',
          criteria: [
            { id: '2.1.1', name: 'Teclado', level: 'A' },
            { id: '2.1.2', name: 'Sin trampas para el foco del teclado', level: 'A' },
            { id: '2.1.4', name: 'Atajos de teclado', level: 'A' },
            { id: '2.2.1', name: 'Tiempo ajustable', level: 'A' },
            { id: '2.2.2', name: 'Poner en pausa, detener, ocultar', level: 'A' },
            { id: '2.3.1', name: 'Umbral de tres destellos o menos', level: 'A' },
            { id: '2.4.1', name: 'Evitar bloques', level: 'A' },
            { id: '2.4.2', name: 'Titulado de páginas', level: 'A' },
            { id: '2.4.3', name: 'Orden del foco', level: 'A' },
            { id: '2.4.4', name: 'Propósito de los enlaces (en contexto)', level: 'A' },
            { id: '2.5.1', name: 'Gestos del puntero', level: 'A' },
            { id: '2.5.2', name: 'Cancelación del puntero', level: 'A' },
            { id: '2.5.3', name: 'Etiqueta en el nombre', level: 'A' },
            { id: '2.5.4', name: 'Actuación por movimiento', level: 'A' },
            { id: '2.4.5', name: 'Múltiples vías', level: 'AA' },
            { id: '2.4.6', name: 'Encabezados y etiquetas', level: 'AA' },
            { id: '2.4.7', name: 'Foco visible', level: 'AA' },
            { id: '2.4.11', name: 'Foco no oculto (mínimo)', level: 'AA' },
            { id: '2.5.7', name: 'Movimientos de arrastre', level: 'AA' },
            { id: '2.5.8', name: 'Tamaño del área de interacción mínimo 24×24px', level: 'AA' },
            { id: '2.1.3', name: 'Teclado (sin excepciones)', level: 'AAA' },
            { id: '2.2.3', name: 'Sin tiempo', level: 'AAA' },
            { id: '2.2.4', name: 'Interrupciones', level: 'AAA' },
            { id: '2.2.5', name: 'Volver a autenticar', level: 'AAA' },
            { id: '2.2.6', name: 'Límites de tiempo', level: 'AAA' },
            { id: '2.3.2', name: 'Tres destellos', level: 'AAA' },
            { id: '2.3.3', name: 'Animaciones desde interacciones', level: 'AAA' },
            { id: '2.4.8', name: 'Ubicación (breadcrumbs)', level: 'AAA' },
            { id: '2.4.9', name: 'Propósito de los enlaces (solo enlaces)', level: 'AAA' },
            { id: '2.4.10', name: 'Encabezados de sección', level: 'AAA' },
            { id: '2.4.12', name: 'Foco no oculto (mejorado)', level: 'AAA' },
            { id: '2.4.13', name: 'Apariencia del foco', level: 'AAA' },
            { id: '2.5.5', name: 'Tamaño del área de interacción (mejorado, 44×44px)', level: 'AAA' },
            { id: '2.5.6', name: 'Mecanismos de entrada concurrentes', level: 'AAA' },
          ],
        },
        {
          id: 3,
          name: 'Comprensible',
          criteria: [
            { id: '3.1.1', name: 'Idioma de la página', level: 'A' },
            { id: '3.2.1', name: 'Al recibir el foco', level: 'A' },
            { id: '3.2.2', name: 'Al recibir entradas', level: 'A' },
            { id: '3.2.6', name: 'Ayuda consistente', level: 'A' },
            { id: '3.3.1', name: 'Identificación de errores', level: 'A' },
            { id: '3.3.2', name: 'Etiquetas o instrucciones', level: 'A' },
            { id: '3.3.7', name: 'Entrada redundante', level: 'A' },
            { id: '3.1.2', name: 'Idioma de las partes de la página', level: 'AA' },
            { id: '3.2.3', name: 'Navegación coherente', level: 'AA' },
            { id: '3.2.4', name: 'Identificación consistente', level: 'AA' },
            { id: '3.3.3', name: 'Sugerencias ante errores', level: 'AA' },
            { id: '3.3.4', name: 'Prevención de errores en páginas legales, financieras y de datos', level: 'AA' },
            { id: '3.3.8', name: 'Autenticación accesible (mínima)', level: 'AA' },
            { id: '3.1.3', name: 'Palabras inusuales', level: 'AAA' },
            { id: '3.1.4', name: 'Abreviaturas', level: 'AAA' },
            { id: '3.1.5', name: 'Nivel de lectura', level: 'AAA' },
            { id: '3.1.6', name: 'Pronunciación', level: 'AAA' },
            { id: '3.2.5', name: 'Cambios a petición', level: 'AAA' },
            { id: '3.3.5', name: 'Ayuda', level: 'AAA' },
            { id: '3.3.6', name: 'Prevención de errores en todo tipo de páginas', level: 'AAA' },
            { id: '3.3.9', name: 'Autenticación accesible (mejorada)', level: 'AAA' },
          ],
        },
        {
          id: 4,
          name: 'Robusto',
          criteria: [
            { id: '4.1.2', name: 'Nombre, función y valor', level: 'A' },
            { id: '4.1.3', name: 'Mensajes de estado', level: 'AA' },
          ],
        },
      ],
    };
  }
}
