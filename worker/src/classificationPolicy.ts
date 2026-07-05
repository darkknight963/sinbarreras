export type FindingCategory = 'violation' | 'alert' | 'manual_check';

export interface ClassificationInput {
  category: FindingCategory;
  selector?: string;
  elementHtml?: string;
  wcagCriterion?: string;
  detectedBy?: string[];
  normalizedRuleId?: string;
}

export interface ClassificationOutput {
  category: FindingCategory;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// Reglas determinísticas: cuando fallan es un HECHO verificable, no una
// heurística (falta el atributo, la referencia no existe, el ratio no alcanza).
// Tasa de falso positivo ~0 según la documentación de axe-core. Estas — y solo
// estas — se reportan como "error confirmado"; todo lo demás baja a alerta o
// revisión manual para proteger la precisión del reporte.
// Fuente única: wcagRules.getRuleDetails importa este mismo set.
export const HIGH_CONFIDENCE_RULES = new Set([
  // Set original
  'duplicate-id',
  'image-alt',
  'button-name',
  'label',
  'color-contrast',
  'color-contrast-enhanced',
  'link-name',
  'input-image-alt',
  // Presencia/valor de atributo: binario, sin ambigüedad
  'html-has-lang',        // el <html> no tiene lang
  'html-lang-valid',      // lang con código BCP 47 inválido
  'html-lang-missing',
  'document-title',       // la página no tiene <title>
  'select-name',          // <select> sin nombre accesible
  'aria-roles',           // role con valor inexistente en ARIA
  'aria-valid-attr-value',// atributo ARIA con valor/referencia inválida
  // Estructura HTML verificable
  'definition-list',      // <dl> con hijos no permitidos
  'dlitem',               // <dt>/<dd> fuera de un <dl>
  'td-headers-attr',      // headers apunta a ids inexistentes en la tabla
]);

export function enforceClassification(input: ClassificationInput): ClassificationOutput {
  const hasSelector = !!(input.selector && input.selector !== 'document');
  const hasHtml = !!(input.elementHtml && input.elementHtml.trim().length > 0);
  const hasWcag = !!input.wcagCriterion;
  const hasToolEvidence = !!(input.detectedBy && input.detectedBy.length > 0);

  if (input.category === 'violation') {
    const deterministicRule = !!(input.normalizedRuleId && HIGH_CONFIDENCE_RULES.has(input.normalizedRuleId));
    const evidenceOk = hasSelector && hasHtml && hasWcag && hasToolEvidence;

    if (deterministicRule && evidenceOk) {
      return { category: 'violation', confidence: 'high', reason: 'Regla automatica deterministica con evidencia completa.' };
    }

    if (evidenceOk) {
      return { category: 'alert', confidence: 'medium', reason: 'Evidencia suficiente pero regla no deterministica; se clasifica como alerta para evitar falso positivo.' };
    }

    return { category: 'manual_check', confidence: 'low', reason: 'Sin evidencia suficiente para violacion automatica confiable.' };
  }

  if (input.category === 'alert') {
    if (hasSelector && hasToolEvidence) {
      return { category: 'alert', confidence: 'medium', reason: 'Hallazgo heuristico con ubicacion trazable.' };
    }
    return { category: 'manual_check', confidence: 'low', reason: 'Alerta sin trazabilidad suficiente; mover a revision manual.' };
  }

  return { category: 'manual_check', confidence: 'low', reason: 'Chequeo manual por naturaleza de la regla.' };
}
