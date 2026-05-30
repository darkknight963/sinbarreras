export interface WcagRuleInfo {
  criterion: string;
  nameEs: string;
  level: 'A' | 'AA' | 'AAA' | 'N/A';
  disability: string[];
  role: 'Desarrollador' | 'Diseñador UX/UI' | 'Redactor UX' | 'Compartido';
  resolutionArticle: string;
  wcagUrl: string;
  findingStatus?: 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';
  suggestedFix?: string;
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
    criterion: '4.1.2',
    nameEs: 'Nombre, funcion y valor - ids unicos',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html'
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

const extraRuleMapping: Record<string, WcagRuleInfo> = {
  'aria-dialog-name': {
    criterion: '4.1.2',
    nameEs: 'Nombre, funcion y valor - dialogo sin nombre',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Agregar un nombre accesible al dialogo usando aria-labelledby con un titulo visible existente o aria-label descriptivo.'
  },
  'aria-valid-attr-value': {
    criterion: '4.1.2',
    nameEs: 'Valores ARIA validos',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Corregir atributos ARIA para que tengan valores validos y referencias existentes, especialmente aria-labelledby.'
  },
  region: {
    criterion: '1.3.1',
    nameEs: 'Informacion y relaciones - regiones',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Ubicar el contenido relevante dentro de landmarks semanticos como main, nav, header, footer o regiones con nombre accesible.'
  },
  'scrollable-region-focusable': {
    criterion: '2.1.1',
    nameEs: 'Teclado - region desplazable',
    level: 'A',
    disability: ['Fisica', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Hacer enfocable el contenedor desplazable con tabindex="0" y asegurar que pueda recorrerse con teclado sin perder el foco.'
  },
  'frame-tested': {
    criterion: 'Revision manual',
    nameEs: 'Contenido embebido no evaluado',
    level: 'N/A',
    disability: ['Todos'],
    role: 'Compartido',
    resolutionArticle: 'Resolucion N 001-2025-PCM/SGTD - Revision manual de contenido embebido',
    wcagUrl: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
    findingStatus: 'not_evaluated',
    suggestedFix: 'Escanear directamente la URL del iframe o revisar manualmente su contenido para confirmar incumplimientos WCAG aplicables.'
  },
  'select-value': {
    criterion: '4.1.2',
    nameEs: 'Nombre, funcion y valor - select sin valor accesible',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Verificar que el select exponga nombre y valor actual a la API de accesibilidad mediante label, option seleccionado y estado valido.'
  },
  'select-optgroup': {
    criterion: '1.3.1',
    nameEs: 'Informacion y relaciones - grupos de opciones',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Si la lista contiene grupos de opciones relacionadas, agruparlas con optgroup y etiquetas descriptivas.'
  },
  'label-not-form-control': {
    criterion: '1.3.1',
    nameEs: 'Informacion y relaciones - label mal asociado',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Corregir el atributo for para que apunte al id de un control de formulario real o asociar el texto mediante aria-describedby si es ayuda.'
  },
  'table-caption-review': {
    criterion: '1.3.1',
    nameEs: 'Informacion y relaciones - caption de tabla',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Si es una tabla de datos, agregar un caption que identifique claramente el proposito de la tabla.'
  },
  'image-ignored-review': {
    criterion: '1.1.1',
    nameEs: 'Contenido no textual - imagen ignorada',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Compartido',
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Confirmar si la imagen es decorativa. Si transmite informacion, quitar aria-hidden y agregar texto alternativo descriptivo.'
  },
  'reflow-fixed-position': {
    criterion: '1.4.10',
    nameEs: 'Reflow - posicion fija',
    level: 'AA',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.10',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Verificar que el elemento fijo no obligue a desplazamiento en dos dimensiones y sea usable a 320 CSS px de ancho.'
  },
  'heading-markup-review': {
    criterion: '1.3.1',
    nameEs: 'Informacion y relaciones - encabezado visual',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Si el texto funciona como encabezado, usar el elemento h1-h6 correspondiente y mantener una jerarquia logica.'
  },
  'textarea-name': {
    criterion: '4.1.2',
    nameEs: 'Nombre, funcion y valor - textarea sin nombre',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Agregar un nombre accesible al textarea con label, title, aria-label o aria-labelledby valido.'
  },
  'form-field-label-missing': {
    criterion: '1.3.1',
    nameEs: 'Informacion y relaciones - campo sin etiqueta',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Etiquetar el campo con label asociado, title, aria-label o aria-labelledby segun corresponda.'
  },
  'iframe-title': {
    criterion: '2.4.1',
    nameEs: 'Evitar bloques - titulo de iframe',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Agregar un atributo title no vacio al iframe que describa su contenido o proposito.'
  },
  'blocking-overlay-needs-review': {
    criterion: 'Revision manual',
    nameEs: 'Bloqueo visual requiere revision',
    level: 'N/A',
    disability: ['Todos'],
    role: 'Compartido',
    resolutionArticle: 'Resolucion N 001-2025-PCM/SGTD - Revision manual',
    wcagUrl: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
    findingStatus: 'needs_review',
    suggestedFix: 'Revisar el sitio en navegador y configurar un script de pre-navegacion seguro si un modal o terminos bloquean el contenido auditado.'
  }
};

function normalizeRuleLookupKey(ruleId: string): string {
  const id = (ruleId || '').toLowerCase();
  const dequeMatch = id.match(/dequeuniversity\.com\/rules\/axe\/[0-9.]+\/([^?)\s]+)/);
  if (dequeMatch?.[1]) return dequeMatch[1];
  if (id.startsWith('axe:')) return id.slice(4);
  if (id.includes('aria-dialog-name')) return 'aria-dialog-name';
  if (id.includes('aria-valid-attr-value')) return 'aria-valid-attr-value';
  if (id.includes('scrollable-region-focusable')) return 'scrollable-region-focusable';
  if (id.includes('form-field-multiple-labels')) return 'form-control-multiple-labels';
  if (id.includes('multiple-labels')) return 'form-control-multiple-labels';
  if (id.includes('required-html5-attribute')) return 'required-html5-indicator';
  if (id.includes('frame-tested')) return 'frame-tested';
  if (id.includes('color-contrast-enhanced')) return 'color-contrast-enhanced';
  if (id.includes('color-contrast') || id.includes('g18.fail')) return 'color-contrast';
  if (id.includes('landmark-one-main') || id.includes('no-main-landmark')) return 'landmark-main-missing';
  if (id.includes('region')) return 'region';
  if (id.includes('h91.select.value')) return 'select-value';
  if (id.includes('h85.2')) return 'select-optgroup';
  if (id.includes('h44.notformcontrol')) return 'label-not-form-control';
  if (id.includes('h39.3.nocaption')) return 'table-caption-review';
  if (id.includes('f77')) return 'duplicate-id';
  if (id.includes('h67.2')) return 'image-ignored-review';
  if (id.includes('bgimage') || id.includes('f24.fgcolour')) return 'contrast-image-background-undetermined';
  if (id.includes('1_4_10')) return 'reflow-fixed-position';
  if (id.includes('h42')) return 'heading-markup-review';
  if (id.includes('h91.textarea.name')) return 'textarea-name';
  if (id.includes('f68')) return 'form-field-label-missing';
  if (id.includes('h64.1')) return 'iframe-title';
  return id;
}

export function getRuleDetails(axeRuleId: string): WcagRuleInfo {
  const lookupKey = normalizeRuleLookupKey(axeRuleId);
  const found = ruleMapping[lookupKey] || extraRuleMapping[lookupKey];
  if (found) {
    const confirmedRules = new Set(['color-contrast', 'color-contrast-enhanced', 'duplicate-id', 'image-alt', 'button-name', 'label', 'link-name', 'input-image-alt']);
    return {
      ...found,
      findingStatus: found.findingStatus || (confirmedRules.has(lookupKey) ? 'confirmed' : 'needs_review'),
      suggestedFix: found.suggestedFix || defaultSuggestedFix(lookupKey),
    };
  }

  return {
    criterion: 'Otros',
    nameEs: `Regla Automática (${axeRuleId})`,
    level: 'A',
    disability: ['Todos'],
    role: 'Desarrollador',
    resolutionArticle: 'Resolución N° 001-2025-PCM/SGTD',
    wcagUrl: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
    findingStatus: 'needs_review',
    suggestedFix: 'Revisar manualmente el hallazgo y determinar el criterio WCAG aplicable en el contexto de la pagina.'
  };
}

function defaultSuggestedFix(ruleKey: string): string {
  if (ruleKey === 'color-contrast') return 'Ajustar los colores de texto y fondo para cumplir contraste WCAG AA: 4.5:1 en texto normal o 3:1 en texto grande.';
  if (ruleKey === 'color-contrast-enhanced') return 'Ajustar los colores de texto y fondo para cumplir contraste WCAG AAA: 7:1 en texto normal o 4.5:1 en texto grande.';
  if (ruleKey === 'duplicate-id') return 'Usar identificadores id unicos en toda la pagina y actualizar referencias asociadas.';
  if (ruleKey === 'landmark-main-missing') return 'Agregar un elemento main o role="main" que envuelva el contenido principal de la pagina.';
  if (ruleKey === 'landmark-nav-missing') return 'Identificar la navegacion principal con nav o role="navigation".';
  if (ruleKey === 'bypass-missing') return 'Agregar un enlace para saltar al contenido principal o mecanismo equivalente para evitar bloques repetitivos.';
  if (ruleKey === 'form-control-multiple-labels') return 'Dejar un solo label programatico asociado al campo y usar aria-describedby para texto de ayuda.';
  if (ruleKey === 'autocomplete-missing') return 'Agregar autocomplete especifico segun el proposito del campo.';
  if (ruleKey === 'required-html5-indicator') return 'Verificar que el campo requerido tenga indicacion visible y programatica, no solo required HTML5.';
  if (ruleKey === 'contrast-image-background-undetermined') return 'Validar manualmente el contraste del texto sobre imagen o fondo heredado real.';
  return 'Corregir el elemento segun el criterio WCAG indicado y validar nuevamente con teclado, lector de pantalla o contraste segun corresponda.';
}
