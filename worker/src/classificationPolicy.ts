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

const HIGH_CONFIDENCE_RULES = new Set([
  'duplicate-id',
  'image-alt',
  'button-name',
  'label',
  'color-contrast',
  'link-name',
  'input-image-alt',
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
