import { wcagCriteria, type WcagCriterion } from './wcag-criteria.js';
import type { ContentDetection } from './content-detector.js';

export type ApplicabilityState = 'aplica' | 'no_aplica';

export interface CriterionApplicability {
  id: string;
  nombre: string;
  nivel: string;
  estado: ApplicabilityState;
  razon: string;
}

function appliesByDetection(id: string, d: ContentDetection): boolean {
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
    case '2.3.2': return d.tiene_animaciones_css;
    case '2.3.3': return d.tiene_animaciones_css;
    case '2.4.4':
    case '2.4.9': return d.tiene_enlaces;
    case '2.4.5':
    case '2.4.8': return d.tiene_contenido_multipagina;
    case '2.4.6': return d.tiene_encabezados || d.tiene_formularios;
    case '2.4.10': return d.tiene_encabezados;
    case '2.5.1': return d.tiene_drag_and_drop;
    case '2.5.2':
    case '2.5.5':
    case '2.5.8': return d.tiene_enlaces || d.tiene_formularios;
    case '2.5.3': return d.tiene_enlaces || d.tiene_formularios;
    case '2.5.4': return false;
    case '2.5.7': return d.tiene_drag_and_drop;
    case '3.1.2': return false;
    case '3.1.3':
    case '3.1.4':
    case '3.1.6': return false;
    case '3.1.5': return true;
    case '3.2.2': return d.tiene_select || d.tiene_checkboxes_radios || d.tiene_formularios;
    case '3.2.3':
    case '3.2.4': return d.tiene_contenido_multipagina;
    case '3.2.6': return d.tiene_ayuda;
    case '3.3.1':
    case '3.3.3': return d.tiene_formularios;
    case '3.3.2':
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

function reasonForNoApply(criterion: WcagCriterion): string {
  return criterion.condicion?.descripción
    ? `No se detectó contenido requerido para aplicar: ${criterion.condicion.descripción}`
    : 'No se detectó condicion de aplicabilidad.';
}

export function buildApplicability(detection: ContentDetection): CriterionApplicability[] {
  return wcagCriteria.map((criterion) => {
    if (criterion.condicion === null) {
      return { id: criterion.id, nombre: criterion.nombre, nivel: criterion.nivel, estado: 'aplica', razon: 'Criterio transversal: siempre aplica.' };
    }

    const applies = appliesByDetection(criterion.id, detection);
    if (!applies) {
      return { id: criterion.id, nombre: criterion.nombre, nivel: criterion.nivel, estado: 'no_aplica', razon: reasonForNoApply(criterion) };
    }

    return { id: criterion.id, nombre: criterion.nombre, nivel: criterion.nivel, estado: 'aplica', razon: criterion.condicion.descripción };
  });
}

export function conservativeApplicability(): CriterionApplicability[] {
  return wcagCriteria.map((criterion) => ({
    id: criterion.id,
    nombre: criterion.nombre,
    nivel: criterion.nivel,
    estado: 'aplica',
    razon: 'Detector de contenido no disponible; se aplica comportamiento conservador.',
  }));
}

export function summarizeApplicability(
  applicability: CriterionApplicability[],
  failedCriterionIds: Set<string>,
  reviewCriterionIds = new Set<string>(),
) {
  const applies = applicability.filter((item) => item.estado === 'aplica');
  const notApplicable = applicability.filter((item) => item.estado === 'no_aplica');
  const failed = applies.filter((item) => failedCriterionIds.has(item.id));
  const review = applies.filter((item) => !failedCriterionIds.has(item.id) && reviewCriterionIds.has(item.id));
  const passed = applies.length - failed.length - review.length;
  const denominator = Math.max(1, applies.length);
  return {
    totalCriteria: applicability.length,
    applicableCount: applies.length,
    notApplicableCount: notApplicable.length,
    failedCount: failed.length,
    reviewCount: review.length,
    passedCount: passed,
    score: Math.max(0, Math.round((passed / denominator) * 100)),
  };
}
