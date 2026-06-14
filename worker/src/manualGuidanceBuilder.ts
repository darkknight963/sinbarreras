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
  'landmark-main-missing': 'Verificar que exista una region principal con <main> o role="main" y que el contenido principal este dentro de ella.',
  'landmark-nav-missing': 'Verificar que la navegacion principal use <nav> o role="navigation" con nombre accesible si hay mas de una.',
  'bypass-missing': 'Verificar que exista un mecanismo de salto al contenido principal (skip link) visible al recibir foco de teclado.',
  'autocomplete-missing': 'Verificar que los campos de datos personales usen valores autocomplete especificos: name, given-name, email, tel, address-line1, postal-code, etc.',
  'form-control-multiple-labels': 'Verificar que cada control de formulario tenga exactamente una etiqueta principal y que instrucciones adicionales usen aria-describedby.',
  'label-empty-text': 'Verificar que la etiqueta asociada tenga texto visible y descriptivo que identifique el proposito del campo.',
  'required-html5-indicator': 'Verificar que campos requeridos tengan indicacion visible (texto "Obligatorio", asterisco con leyenda) y que el error se anuncie correctamente.',
  'contrast-image-background-undetermined': 'Verificar manualmente el contraste de texto sobre imagen o gradiente. Medir con herramienta de captura de pantalla y selector de color.',
  'h1-in-header': 'Verificar si el h1 en el encabezado representa el contenido unico de la pagina o solo la marca repetida. El h1 debe ser unico por pagina.',
  'empty-list-item': 'Verificar si el li vacio tiene proposito decorativo (usar CSS) o si es un error de maquetacion que debe eliminarse.',
  'table-purpose-review': 'Determinar si la tabla presenta datos relacionados. Si es de datos, debe tener th, scope y caption; si es maquetacion, usar CSS o role="presentation".',
  'title-non-interactive': 'Verificar si el title aporta informacion unica no disponible de otro modo. Si es redundante, eliminarlo; si es necesario, hacerlo visible.',
  'blocking-overlay-needs-review': 'Verificar que el overlay tenga: nombre accesible (aria-labelledby), foco gestionado al abrir, cierre con Escape, y que el fondo sea inaccesible con aria-hidden/inert.',
  'content-behind-dialog-accessible': 'Confirmar que cuando el dialogo esta abierto, el contenido de fondo no recibe foco ni es legible por lector de pantalla (inert o aria-hidden en el fondo).',
  'frame-tested': 'Evaluar directamente la URL del iframe o revisar su contenido en el navegador buscando violaciones de contraste, texto alternativo, formularios y navegacion por teclado.',
  'link-href-missing': 'Verificar si el elemento a sin href tiene comportamiento interactivo. Si lo tiene, convertirlo a button; si no, verificar que su cursor y apariencia no induzcan a pensar que es interactivo.',
  'aria-required-owned-element': 'Verificar la estructura del widget ARIA. El rol padre debe contener los roles hijos requeridos directamente o mediante aria-owns.',
  'reflow-fixed-position': 'Verificar en 320px CSS de ancho que no aparezca scrollbar horizontal y que el elemento fijo no oculte contenido. Usar DevTools para simular.',
  'image-ignored-review': 'Verificar si la imagen con aria-hidden o alt="" transmite informacion visual unica. Si la transmite, agregar texto alternativo descriptivo.',
  'heading-markup-review': 'Verificar si el texto que parece un titulo usa el nivel de encabezado correcto en la jerarquia de la pagina. Revisar el orden h1 > h2 > h3 sin saltos.',
};

function buildStepsForRule(ruleId: string, category: string): string[] {
  const base = [
    'Localizar el elemento en la evidencia visual o en el inspector del navegador.',
    'Verificar el comportamiento con solo teclado (Tab, Enter, Escape, flechas).',
    'Confirmar con lector de pantalla (NVDA, JAWS o VoiceOver) si el elemento es anunciado correctamente.',
    'Comparar contra el criterio WCAG y determinar: cumple / no cumple / no aplica.',
  ];
  if (ruleId.includes('contrast')) {
    return [
      'Capturar el elemento con la herramienta de captura del navegador.',
      'Usar un selector de color para medir el color exacto del texto y el fondo real.',
      'Calcular la relacion de contraste con WebAIM Contrast Checker o similar.',
      'Si es inferior a 4.5:1 (texto normal) o 3:1 (texto grande), registrar como no cumple.',
    ];
  }
  if (ruleId.includes('iframe') || ruleId.includes('frame')) {
    return [
      'Copiar la URL del src del iframe y abrirla directamente en el navegador.',
      'Ejecutar el escaner sobre esa URL para obtener un informe completo de su contenido.',
      'Si el iframe es de terceros (YouTube, Maps, reCAPTCHA), verificar documentacion de accesibilidad del proveedor.',
      'Registrar el estado de accesibilidad del contenido embebido.',
    ];
  }
  if (ruleId.includes('table')) {
    return [
      'Inspeccionar la tabla en el DOM y determinar si sus celdas contienen datos relacionados.',
      'Si es tabla de datos: verificar presencia de th, scope y caption descriptivo.',
      'Si es tabla de maquetacion: agregar role="presentation" o reemplazar por CSS.',
      'Navegar la tabla con lector de pantalla para confirmar que la estructura es comprensible.',
    ];
  }
  if (ruleId.includes('overlay') || ruleId.includes('dialog')) {
    return [
      'Abrir el dialogo/overlay con teclado y verificar que el foco se mueva al interior.',
      'Confirmar que Escape cierra el dialogo y devuelve el foco al elemento que lo abrio.',
      'Verificar con lector de pantalla que el nombre del dialogo es anunciado al abrirse.',
      'Confirmar que el contenido de fondo no es alcanzable con Tab mientras el dialogo esta abierto.',
    ];
  }
  return base;
}

export function buildManualGuidance(input: GuidanceInput): ManualGuidance | null {
  if (input.category === 'violation') return null;

  const specific = RULE_GUIDANCE[input.normalizedRuleId] || 'Verificar manualmente el criterio en el contexto funcional real.';

  return {
    whatToReview: specific,
    whyItMatters: `Criterio WCAG ${input.wcagCriterion || 'N/A'} (${input.wcagLevel || 'N/A'}). ${input.description}`,
    whereToReview: `Selector: ${input.selector}${input.elementHtml ? ' | Fragmento HTML capturado disponible.' : ''}`,
    steps: buildStepsForRule(input.normalizedRuleId, input.category),
    expectedDecision: 'cumple/no cumple/no aplica',
  };
}
