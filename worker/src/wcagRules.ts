export interface WcagRuleInfo {
  criterion: string;
  nameEs: string;
  level: 'A' | 'AA' | 'AAA';
  disability: string[];
  role: 'Desarrollador' | 'Diseñador UX/UI' | 'Redactor UX' | 'Compartido';
  resolutionArticle: string;
  wcagUrl: string;
}

export const ruleMapping: Record<string, WcagRuleInfo> = {
  'image-alt': {
    criterion: '1.1.1',
    nameEs: 'Contenido no textual',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Compartido', // Redactor UX y Desarrollador
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html'
  },
  'color-contrast': {
    criterion: '1.4.3',
    nameEs: 'Contraste mínimo',
    level: 'AA',
    disability: ['Sensorial visual (Baja visión)'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.3',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html'
  },
  'color-contrast-enhanced': {
    criterion: '1.4.6',
    nameEs: 'Contraste mejorado',
    level: 'AAA',
    disability: ['Sensorial visual (Baja visión)'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.6',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html'
  },
  'document-title': {
    criterion: '2.4.2',
    nameEs: 'Titulado de páginas',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html'
  },
  'html-has-lang': {
    criterion: '3.1.1',
    nameEs: 'Idioma de la página',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html'
  },
  'html-lang-valid': {
    criterion: '3.1.1',
    nameEs: 'Idioma de la página (Válido)',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html'
  },
  'valid-lang': {
    criterion: '3.1.2',
    nameEs: 'Idioma de las partes de la página',
    level: 'AA',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Compartido',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html'
  },
  'bypass': {
    criterion: '2.4.1',
    nameEs: 'Evitar bloques',
    level: 'A',
    disability: ['Física', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html'
  },
  'focus-visible': {
    criterion: '2.4.7',
    nameEs: 'Foco visible',
    level: 'AA',
    disability: ['Física', 'Sensorial visual'],
    role: 'Compartido', // Desarrollador y Diseñador UX/UI
    resolutionArticle: 'Anexo 1 - Criterio 2.4.7',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html'
  },
  'label': {
    criterion: '3.3.2',
    nameEs: 'Etiquetas o instrucciones',
    level: 'A',
    disability: ['Intelectual', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html'
  },
  'aria-allowed-attr': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html'
  },
  'aria-roles': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html'
  },
  'link-name': {
    criterion: '2.4.4',
    nameEs: 'Propósito de los enlaces',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.4',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html'
  },
  'input-image-alt': {
    criterion: '1.1.1',
    nameEs: 'Contenido no textual',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html'
  },
  'button-name': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html'
  },
  'target-size': {
    criterion: '2.5.8',
    nameEs: 'Tamaño del área de interacción mínimo',
    level: 'AA',
    disability: ['Física'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 2.5.8',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html'
  },
  'duplicate-id': {
    criterion: '4.1.1',
    nameEs: 'Analisis y sintaxis valida',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/parsing.html'
  },
  'landmark-main-missing': {
    criterion: '2.4.1',
    nameEs: 'Evitar bloques (main landmark)',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html'
  },
  'landmark-nav-missing': {
    criterion: '2.4.1',
    nameEs: 'Evitar bloques (nav landmark)',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html'
  },
  'bypass-missing': {
    criterion: '2.4.1',
    nameEs: 'Metodo para saltar bloques',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html'
  },
  'form-control-multiple-labels': {
    criterion: '3.3.2',
    nameEs: 'Etiquetas multiples por control',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html'
  },
  'label-empty-text': {
    criterion: '3.3.2',
    nameEs: 'Etiqueta vacia',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html'
  },
  'autocomplete-missing': {
    criterion: '1.3.5',
    nameEs: 'Identificar proposito de entrada',
    level: 'AA',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.5',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html'
  },
  'required-html5-indicator': {
    criterion: '3.3.2',
    nameEs: 'Indicacion de campos requeridos',
    level: 'A',
    disability: ['Intelectual', 'Sensorial visual'],
    role: 'Compartido',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html'
  },
  'contrast-image-background-undetermined': {
    criterion: '1.4.3',
    nameEs: 'Contraste sobre fondo imagen (revision)',
    level: 'AA',
    disability: ['Sensorial visual'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.3',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html'
  }
};

export function getRuleDetails(axeRuleId: string): WcagRuleInfo {
  return ruleMapping[axeRuleId] || {
    criterion: 'Otros',
    nameEs: `Regla Automática (${axeRuleId})`,
    level: 'A',
    disability: ['Todos'],
    role: 'Desarrollador',
    resolutionArticle: 'Resolución N° 001-2025-PCM/SGTD',
    wcagUrl: 'https://www.w3.org/WAI/standards-guidelines/wcag/'
  };
}
