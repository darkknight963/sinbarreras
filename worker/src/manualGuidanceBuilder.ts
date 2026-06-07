interface GuidanceInput {
  category: 'violation' | 'alert' | 'manual_check';
  wcagCriterion?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  normalizedRuleId: string;
  description: string;
  selector: string;
  elementHtml?: string;
}

export interface ManualGuidance {
  whatToReview: string;
  whyItMatters: string;
  whereToReview: string;
  steps: string[];
  expectedDecision: 'cumple/no cumple/no aplica';
}

const RULE_GUIDANCE: Record<string, string> = {
  'landmark-main-missing': 'Verificar que exista una región principal con <main> o role="main" para navegación asistida.',
  'landmark-nav-missing': 'Verificar que la navegación principal use <nav> o role="navigation".',
  'bypass-missing': 'Verificar un mecanismo de salto al contenido principal (skip link).',
  'autocomplete-missing': 'Verificar que los campos de datos personales usen autocomplete especifico (name, email, tel, etc.).',
  'form-control-multiple-labels': 'Verificar que cada control tenga una sola etiqueta principal consistente.',
  'label-empty-text': 'Verificar que la etiqueta asociada tenga texto visible y descriptivo.',
  'required-html5-indicator': 'Verificar que el requisito de campo no dependa solo del atributo required y tenga instruccion visible.',
  'contrast-image-background-undetermined': 'Verificar manualmente contraste de texto sobre imagen o gradiente de fondo.',
};

export function buildManualGuidance(input: GuidanceInput): ManualGuidance | null {
  if (input.category === 'violation') return null;

  const specific = RULE_GUIDANCE[input.normalizedRuleId] || 'Verificar manualmente el criterio en el contexto funcional real.';

  return {
    whatToReview: specific,
    whyItMatters: `Criterio WCAG ${input.wcagCriterion || 'N/A'} (${input.wcagLevel || 'N/A'}). ${input.description}`,
    whereToReview: `Selector: ${input.selector}${input.elementHtml ? ' | Fragmento HTML capturado disponible.' : ''}`,
    steps: [
      'Abrir el elemento resaltado en la evidencia visual y confirmar contexto de uso.',
      'Validar el comportamiento con teclado y lector de pantalla (si aplica).',
      'Contrastar contra el criterio WCAG y la norma peruana aplicable.',
      'Registrar resultado con evidencia: cumple, no cumple o no aplica.',
    ],
    expectedDecision: 'cumple/no cumple/no aplica',
  };
}
