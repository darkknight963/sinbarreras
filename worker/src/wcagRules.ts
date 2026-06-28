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
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    suggestedFix: 'Si la imagen transmite informacion, agregar alt descriptivo y breve (maximo 150 caracteres). Si es decorativa, usar alt="" y no agregar aria-hidden salvo en svgs decorativos.'
  },
  'color-contrast': {
    criterion: '1.4.3',
    nameEs: 'Contraste mínimo',
    level: 'AA',
    disability: ['Sensorial visual (Baja visión)'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.3',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    suggestedFix: 'Ajustar los colores de texto y fondo para alcanzar una relacion de contraste de al menos 4.5:1 en texto normal (menos de 18pt) o 3:1 en texto grande (18pt o 14pt negrita). Usar herramientas como WebAIM Contrast Checker para verificar.'
  },
  'color-contrast-enhanced': {
    criterion: '1.4.6',
    nameEs: 'Contraste mejorado',
    level: 'AAA',
    disability: ['Sensorial visual (Baja visión)'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.6',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html',
    suggestedFix: 'Para nivel AAA ajustar contraste a minimo 7:1 en texto normal y 4.5:1 en texto grande. Especialmente critico para usuarios con baja vision severa.'
  },
  'document-title': {
    criterion: '2.4.2',
    nameEs: 'Titulado de páginas',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html',
    suggestedFix: 'Definir un title unico y descriptivo con formato "Nombre pagina | Sistema" (maximo 60-70 caracteres). Actualizar en cada vista de SPA.'
  },
  'html-has-lang': {
    criterion: '3.1.1',
    nameEs: 'Idioma de la página',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
    suggestedFix: 'Agregar lang="es" o el BCP 47 correspondiente en el elemento html. Para contenido peruano usar lang="es-PE". Marcar fragmentos en otro idioma con lang propio.'
  },
  'html-lang-valid': {
    criterion: '3.1.1',
    nameEs: 'Idioma de la página (Válido)',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
    suggestedFix: 'Verificar que el codigo de idioma sea un BCP 47 valido, por ejemplo es, es-PE, en, en-US. Codigos invalidos pueden confundir al lector de pantalla.'
  },
  'html-lang-missing': {
    criterion: '3.1.1',
    nameEs: 'Idioma de la pagina',
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
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar antes del primer elemento interactivo un enlace "Saltar al contenido" visible al foco que apunte a id="main-content". Confirmar que el destino existe y recibe foco.'
  },
  'focus-visible': {
    criterion: '2.4.7',
    nameEs: 'Foco visible',
    level: 'AA',
    disability: ['Física', 'Sensorial visual'],
    role: 'Compartido', // Desarrollador y Diseñador UX/UI
    resolutionArticle: 'Anexo 1 - Criterio 2.4.7',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
    suggestedFix: 'Definir :focus-visible con outline minimo de 2px de contraste 3:1, sin eliminar el outline del navegador sin reemplazo. Evitar outline:none sin definir estilo alternativo.'
  },
  'label': {
    criterion: '3.3.2',
    nameEs: 'Etiquetas o instrucciones',
    level: 'A',
    disability: ['Intelectual', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    suggestedFix: 'Asociar cada control con label[for="id"] visible. Priorizar texto visible sobre aria-label. Usar aria-describedby para instrucciones adicionales, no como etiqueta principal.'
  },
  'aria-allowed-attr': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    suggestedFix: 'Eliminar atributos ARIA no permitidos para el rol del elemento. Consultar la especificacion ARIA para ver que atributos acepta cada rol y preferir HTML nativo.'
  },
  'aria-roles': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    suggestedFix: 'Usar solo roles ARIA validos de la especificacion WAI-ARIA 1.2. Preferir elementos HTML nativos con semantica equivalente cuando existan (button, nav, main, etc.).'
  },
  'link-name': {
    criterion: '2.4.4',
    nameEs: 'Propósito de los enlaces',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.4',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
    suggestedFix: 'Agregar texto visible descriptivo al enlace. Si solo tiene icono, usar aria-label con el proposito real, por ejemplo "Ver perfil de usuario". Evitar textos genericos como "click aqui" o "leer mas".'
  },
  'input-image-alt': {
    criterion: '1.1.1',
    nameEs: 'Contenido no textual',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    suggestedFix: 'Agregar alt al input[type=image] con el texto que describe la accion del boton (no la imagen), por ejemplo alt="Buscar". Si es decorativo, usar input[type=submit] con value descriptivo.'
  },
  'button-name': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    suggestedFix: 'Agregar nombre accesible al boton: texto visible preferente, aria-label para botones icono o aria-labelledby apuntando a texto existente. El nombre debe describir la accion, no el elemento.'
  },
  'button-name-missing': {
    criterion: '4.1.2',
    nameEs: 'Boton sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed'
  },
  'input-name-missing': {
    criterion: '4.1.2',
    nameEs: 'Campo sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed'
  },
  'link-name-missing': {
    criterion: '2.4.4',
    nameEs: 'Enlace sin texto o nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.4',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
    findingStatus: 'confirmed'
  },
  'link-href-missing': {
    criterion: '2.1.1',
    nameEs: 'Enlace sin href',
    level: 'A',
    disability: ['Fisica', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'needs_review'
  },
  'target-size': {
    criterion: '2.5.8',
    nameEs: 'Tamaño del área de interacción mínimo',
    level: 'AA',
    disability: ['Física'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 2.5.8',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
    suggestedFix: 'Asegurar que areas de interaccion tengan minimo 24x24 CSS px (WCAG 2.2 AA) o preferiblemente 44x44 CSS px para mejor usabilidad movil. Usar padding en lugar de aumentar el elemento si es necesario.'
  },
  'duplicate-id': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor - ids únicos',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    suggestedFix: 'Asignar ids unicos en toda la pagina incluyendo componentes reutilizables. Actualizar todos los for, aria-labelledby, aria-controls, aria-describedby que referencian el id duplicado.'
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
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    findingStatus: 'needs_review'
  },
  'h1-in-header': {
    criterion: '2.4.1',
    nameEs: 'H1 dentro del encabezado',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    findingStatus: 'needs_review'
  },
  'content-behind-dialog-accessible': {
    criterion: '1.3.2',
    nameEs: 'Contenido detras del dialogo accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html',
    findingStatus: 'confirmed'
  },
  'empty-list-item': {
    criterion: '1.3.1',
    nameEs: 'Elemento de lista vacio',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review'
  },
  'aria-required-owned-element': {
    criterion: '4.1.2',
    nameEs: 'Widget ARIA sin elemento hijo requerido',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed'
  },
  'aria-widget-name-missing': {
    criterion: '4.1.2',
    nameEs: 'Widget ARIA sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed'
  },
  'table-purpose-review': {
    criterion: '1.3.1',
    nameEs: 'Proposito de tabla no claro',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review'
  },
  'title-non-interactive': {
    criterion: '3.3.2',
    nameEs: 'Title en elemento no interactivo',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Compartido',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    findingStatus: 'needs_review'
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
  },

  // ── IBM Equal Access: ruleIds frecuentes no cubiertos por axe ─────────────
  'aria_keyboard_handler_exists': {
    criterion: '2.1.1', nameEs: 'Manejador de teclado faltante en elemento interactivo',
    level: 'A', disability: ['Motora'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar manejadores de teclado (keydown/keyup) equivalentes a los manejadores de raton en elementos interactivos. Preferir elementos nativos como button o a que ya tienen soporte de teclado incorporado.'
  },
  'aria_widget_labelled': {
    criterion: '4.1.2', nameEs: 'Widget ARIA sin nombre accesible',
    level: 'A', disability: ['Visual', 'Cognitiva'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar aria-label o aria-labelledby apuntando a un titulo visible para el widget ARIA.'
  },
  'aria_child_tabbable': {
    criterion: '2.1.1', nameEs: 'Elemento hijo no alcanzable por teclado',
    level: 'A', disability: ['Motora'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Asegurarse de que los elementos hijos interactivos dentro del widget sean alcanzables con Tab o con las teclas de cursor segun el patron de diseno ARIA.'
  },
  'aria_hidden_nontabbable': {
    criterion: '4.1.2', nameEs: 'Elemento oculto con acceso de teclado',
    level: 'A', disability: ['Visual'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Si el elemento esta oculto con aria-hidden="true", agregarlo tambien al flujo de tabulacion con tabindex="-1" o eliminarlo del DOM visible.'
  },
  'aria_role_allowed_props': {
    criterion: '4.1.2', nameEs: 'Propiedad ARIA no permitida para el rol',
    level: 'A', disability: ['Visual'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Eliminar el atributo ARIA no permitido para este rol. Consultar la especificacion WAI-ARIA 1.2 para ver que atributos acepta cada rol.'
  },
  'aria_semantics_role': {
    criterion: '4.1.2', nameEs: 'Rol ARIA semanticamente incorrecto',
    level: 'A', disability: ['Visual', 'Cognitiva'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Usar el rol ARIA correcto para el elemento o preferir el elemento HTML nativo equivalente.'
  },
  'aria_landmark_name_unique': {
    criterion: '1.3.6', nameEs: 'Landmark ARIA con nombre duplicado',
    level: 'AAA', disability: ['Visual'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 1.3.6',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-purpose.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar aria-label unico a cada landmark del mismo tipo para que los lectores de pantalla puedan distinguirlos.'
  },
  'aria_content_in_landmark': {
    criterion: '1.3.1', nameEs: 'Contenido fuera de landmark semantico',
    level: 'A', disability: ['Visual'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Mover el contenido dentro de un landmark semantico (main, nav, header, footer, aside, section con aria-label).'
  },
  'aria_eventhandler_role_valid': {
    criterion: '4.1.2', nameEs: 'Elemento con evento sin rol accesible',
    level: 'A', disability: ['Visual', 'Motora'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Reemplazar el div o span con manejador de evento por un elemento nativo como button o a, o agregar role, tabindex y manejadores de teclado equivalentes.'
  },
  'rpt_elem_event_mouseevent': {
    criterion: '2.1.1', nameEs: 'Evento de raton sin alternativa de teclado',
    level: 'A', disability: ['Motora'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar un evento de teclado equivalente (keydown con Enter/Space) para cada manejador onclick en elementos no nativos.'
  },
  'rpt_elem_misuse': {
    criterion: '1.3.1', nameEs: 'Elemento HTML usado incorrectamente',
    level: 'A', disability: ['Visual', 'Cognitiva'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Usar el elemento HTML semanticamente correcto para el proposito del contenido.'
  },
  'identical_links_same_purpose': {
    criterion: '2.4.9', nameEs: 'Enlaces identicos con distinto destino',
    level: 'AAA', disability: ['Visual', 'Cognitiva'], role: 'Redactor UX',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.4.9',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-link-only.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Diferenciar el texto visible o el aria-label de los enlaces que apuntan a destinos distintos, por ejemplo "Leer mas sobre COVID-19" en lugar de "Leer mas".'
  },
  'wcag20_a_targetsize': {
    criterion: '2.5.8', nameEs: 'Area de interaccion demasiado pequeña',
    level: 'AA', disability: ['Motora'], role: 'Diseñador UX/UI',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.5.8',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Asegurar que areas de interaccion tengan minimo 24x24 CSS px (WCAG 2.2 AA) o preferiblemente 44x44 CSS px para mejor usabilidad movil.'
  },
  'wcag20_input_label_exists': {
    criterion: '1.3.1', nameEs: 'Campo de formulario sin etiqueta visible',
    level: 'A', disability: ['Visual', 'Cognitiva'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Asociar cada campo con un label visible usando for/id o envolver el control dentro del label.'
  }
};

function normalizeRuleLookupKey(ruleId: string): string {
  const id = (ruleId || '').toLowerCase();

  // axe-core: extraer nombre de regla de URL Deque o prefijo axe:
  const dequeMatch = id.match(/dequeuniversity\.com\/rules\/axe\/[0-9.]+\/([^?)\s]+)/);
  if (dequeMatch?.[1]) return dequeMatch[1];
  if (id.startsWith('axe:')) return id.slice(4);

  // Reglas propias heuristic-dom (nombres exactos con guion, nunca ambiguos)
  if (id === 'html-lang-missing') return 'html-lang-missing';
  if (id === 'aria-dialog-name') return 'aria-dialog-name';
  if (id === 'aria-required-owned-element') return 'aria-required-owned-element';
  if (id === 'aria-widget-name-missing') return 'aria-widget-name-missing';
  if (id === 'aria-valid-attr-value') return 'aria-valid-attr-value';
  if (id === 'scrollable-region-focusable') return 'scrollable-region-focusable';
  if (id === 'empty-list-item') return 'empty-list-item';
  if (id === 'link-href-missing') return 'link-href-missing';
  if (id === 'link-name-missing') return 'link-name-missing';
  if (id === 'button-name-missing') return 'button-name-missing';
  if (id === 'input-name-missing') return 'input-name-missing';
  if (id === 'table-purpose-review') return 'table-purpose-review';
  if (id === 'title-non-interactive') return 'title-non-interactive';
  if (id === 'h1-in-header') return 'h1-in-header';
  if (id === 'content-behind-dialog-accessible') return 'content-behind-dialog-accessible';
  if (id === 'frame-tested') return 'frame-tested';
  if (id === 'color-contrast-enhanced') return 'color-contrast-enhanced';
  if (id === 'color-contrast') return 'color-contrast';
  if (id === 'landmark-main-missing') return 'landmark-main-missing';
  if (id === 'landmark-nav-missing') return 'landmark-nav-missing';
  if (id === 'bypass-missing') return 'bypass-missing';
  if (id === 'aria-allowed-attr' || id === 'aria-prohibited-attr') return 'aria-allowed-attr';
  if (id === 'aria-roles' || id === 'aria-required-attr' || id === 'aria-conditional-attr') return 'aria-roles';
  if (id === 'autocomplete-missing' || id === 'autocomplete-valid') return 'autocomplete-missing';
  if (id === 'form-control-multiple-labels' || id === 'form-field-multiple-labels' || id === 'multiple-labels') return 'form-control-multiple-labels';
  if (id === 'required-html5-indicator' || id === 'required-html5-attribute') return 'required-html5-indicator';
  if (id === 'duplicate-id') return 'duplicate-id';
  if (id === 'region') return 'region';
  if (id === 'focus-visible') return 'focus-visible';
  if (id === 'target-size') return 'target-size';
  if (id === 'document-title') return 'document-title';
  if (id === 'image-alt' || id === 'image-ignored-review' || id === 'input-image-alt') return id;
  if (id === 'label' || id === 'label-empty-text' || id === 'label-not-form-control') return id;
  if (id === 'form-field-label-missing') return 'form-field-label-missing';
  if (id === 'heading-markup-review') return 'heading-markup-review';
  if (id === 'iframe-title') return 'iframe-title';
  if (id === 'link-name') return 'link-name';
  if (id === 'button-name') return 'button-name';
  if (id === 'reflow-fixed-position') return 'reflow-fixed-position';
  if (id === 'html-has-lang') return 'html-has-lang';
  if (id === 'html-lang-valid') return 'html-lang-valid';
  if (id === 'valid-lang') return 'valid-lang';
  if (id === 'contrast-image-background-undetermined') return 'contrast-image-background-undetermined';
  if (id === 'select-value') return 'select-value';
  if (id === 'textarea-name') return 'textarea-name';

  // axe-core reglas con sufijos o variantes
  if (id.includes('color-contrast-enhanced')) return 'color-contrast-enhanced';
  if (id.includes('color-contrast') || id.includes('g18.fail') || id.includes('g145.fail') || id.includes('g18.4') || id.includes('g145.4')) return 'color-contrast';
  if (id.includes('duplicate-id') || id.includes('f77') || id.includes('duplicate_id')) return 'duplicate-id';
  if (id.includes('scrollable-region-focusable') || id.includes('element_scrollable_tabbable')) return 'scrollable-region-focusable';
  if (id.includes('aria-allowed-attr') || id.includes('aria-prohibited-attr')) return 'aria-allowed-attr';
  if (id.includes('aria-required-owned-element')) return 'aria-required-owned-element';
  if (id.includes('aria-valid-attr-value')) return 'aria-valid-attr-value';
  if (id.includes('aria-roles') || id.includes('aria-required-attr') || id.includes('aria-conditional-attr')) return 'aria-roles';
  if (id.includes('autocomplete-valid') || id.includes('autocomplete-missing')) return 'autocomplete-missing';
  if (id.includes('button-name')) return 'button-name';
  if (id.includes('link-name')) return id.includes('missing') ? 'link-name-missing' : 'link-name';
  if (id.includes('link-href')) return 'link-href-missing';
  if (id.includes('image-alt') || id.includes('img.alt') || id.includes('img_alt')) return 'image-alt';
  if (id.includes('input-image-alt') || id.includes('h36.2') || id.includes('input.image')) return 'input-image-alt';
  if (id.includes('iframe-title') || id.includes('h64')) return 'iframe-title';
  if (id.includes('heading-order') || id.includes('heading_markup') || id.includes('h42') || id.includes('h69')) return 'heading-markup-review';
  if (id.includes('document-title') || id.includes('doc_title')) return 'document-title';
  if (id.includes('focus-visible') || id.includes('focus_visible')) return 'focus-visible';
  if (id.includes('target-size') || id.includes('target_size')) return 'target-size';
  if (id.includes('label-content-name') || id.includes('label_in_name')) return 'button-name';
  if (id.includes('reflow') || id.includes('1_4_10')) return 'reflow-fixed-position';

  // Códigos HTMLCS / Pa11y exactos (prefijos cortos, sin ambigüedad)
  if (id === 'h30' || id.startsWith('h30.') || id.includes('e501') || id.includes('link_in_text_block')) return 'link-name';
  if (id === 'h37' || id === 'h36.1' || id === 'h45') return 'image-alt';
  if (id === 'h36.2') return 'input-image-alt';
  if (id === 'h48' || id.includes('list_markup')) return 'empty-list-item';
  if (id === 'h63' || id === 'h51' || id.includes('table_headers')) return 'table-purpose-review';
  if (id === 'h65' || id === 'h91.input' || id.includes('input_label')) return 'input-name-missing';
  if (id === 'h71' || id === 'h32' || (id.includes('fieldset') && !id.includes('aria'))) return 'form-field-label-missing';
  if (id === 'h91.select.value') return 'select-value';
  if (id === 'h91.select.name') return 'input-name-missing';
  if (id === 'h91.textarea.name') return 'textarea-name';
  if (id === 'h91.button' || id.startsWith('h91.button')) return 'button-name';
  if (id === 'h85.2') return 'select-optgroup';
  if (id === 'h44.notformcontrol' || id === 'h44.2') return id === 'h44.2' ? 'form-field-label-missing' : 'label-not-form-control';
  if (id === 'h39.3.nocaption') return 'table-caption-review';
  if (id === 'h67.2') return 'image-ignored-review';
  if (id === 'h64.1') return 'iframe-title';
  if (id === 'f55') return 'link-href-missing';
  if (id === 'f68' || id === 'h71.3') return 'form-field-label-missing';
  if (id === 'f77') return 'duplicate-id';
  if (id === 'g1.1' || id.includes('skip_link') || id === 'bypass') return 'bypass-missing';

  // IBM Equal Access — ruleIds exactos con entrada propia en ruleMapping
  if (id === 'aria_keyboard_handler_exists') return 'aria_keyboard_handler_exists';
  if (id === 'aria_widget_labelled') return 'aria_widget_labelled';
  if (id === 'aria_child_tabbable') return 'aria_child_tabbable';
  if (id === 'aria_hidden_nontabbable') return 'aria_hidden_nontabbable';
  if (id === 'aria_role_allowed_props') return 'aria_role_allowed_props';
  if (id === 'aria_semantics_role') return 'aria_semantics_role';
  if (id === 'aria_landmark_name_unique') return 'aria_landmark_name_unique';
  if (id === 'aria_content_in_landmark') return 'aria_content_in_landmark';
  if (id === 'aria_eventhandler_role_valid') return 'aria_eventhandler_role_valid';
  if (id === 'rpt_elem_event_mouseevent') return 'rpt_elem_event_mouseevent';
  if (id === 'rpt_elem_misuse') return 'rpt_elem_misuse';
  if (id === 'identical_links_same_purpose') return 'identical_links_same_purpose';
  if (id === 'wcag20_a_targetsize') return 'wcag20_a_targetsize';
  if (id === 'wcag20_input_label_exists') return 'wcag20_input_label_exists';

  // IBM Equal Access — patrones de prefijo para ruleIds menos comunes
  if (id.includes('rpt_elem_lang_empty') || id.includes('aria.documentlanguage') || id.includes('html_lang')) return 'html-lang-missing';
  if (id.includes('rpt_elem_href') || id === 'f55') return 'link-href-missing';
  if (id.includes('rpt_img_alt') || id.includes('wcag20_img_hasalt')) return 'image-alt';
  if (id.includes('landmark_banner') || id.includes('aria.banner')) return 'landmark-main-missing';
  if (id.includes('bgimage') || id.includes('f24.fgcolour')) return 'contrast-image-background-undetermined';
  if (id.includes('duplicate_id')) return 'duplicate-id';
  if (id.includes('landmark') && id.includes('nav')) return 'landmark-nav-missing';
  if (id.includes('landmark-one-main') || id.includes('no-main-landmark') || id.includes('landmark-main')) return 'landmark-main-missing';
  if (id.includes('autocomplete')) return 'autocomplete-missing';
  if (id.includes('region') && !id.includes('scrollable')) return 'region';

  // Cualquier ruleId no reconocido: devolver tal cual para no clasificar mal
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

export function defaultSuggestedFix(ruleKey: string): string {
  if (ruleKey === 'image-alt') return 'Si la imagen transmite informacion, agregar alt descriptivo y breve. Si es decorativa, dejar alt="" y evitar aria-hidden en imagenes informativas.';
  if (ruleKey === 'color-contrast') return 'Ajustar los colores de texto y fondo para cumplir contraste WCAG AA: 4.5:1 en texto normal o 3:1 en texto grande.';
  if (ruleKey === 'color-contrast-enhanced') return 'Ajustar los colores de texto y fondo para cumplir contraste WCAG AAA: 7:1 en texto normal o 4.5:1 en texto grande.';
  if (ruleKey === 'duplicate-id') return 'Usar identificadores id unicos en toda la pagina y actualizar referencias asociadas.';
  if (ruleKey === 'document-title') return 'Definir un title unico y descriptivo que identifique la pagina actual y el sistema, por ejemplo: "Mesa de partes - Envio de documentos".';
  if (ruleKey === 'html-has-lang' || ruleKey === 'html-lang-valid' || ruleKey === 'html-lang-missing') return 'Agregar en el elemento html un atributo lang valido segun el idioma principal, por ejemplo lang="es", y usar lang en fragmentos con otro idioma.';
  if (ruleKey === 'landmark-main-missing') return 'Envolver el contenido principal con un unico <main id="main-content"> o role="main"; no incluir header, nav ni footer repetitivos dentro del main.';
  if (ruleKey === 'landmark-nav-missing') return 'Marcar la navegacion principal con <nav aria-label="Navegacion principal"> o role="navigation" con nombre accesible cuando haya mas de una navegacion.';
  if (ruleKey === 'bypass-missing') return 'Agregar antes del encabezado un enlace "Saltar al contenido principal" que apunte a #main-content, sea visible al recibir foco y funcione con teclado.';
  if (ruleKey === 'focus-visible') return 'Definir un indicador :focus-visible claro, de al menos 2 px y con contraste suficiente, sin eliminar el outline por defecto sin reemplazo.';
  if (ruleKey === 'label' || ruleKey === 'form-field-label-missing' || ruleKey === 'input-name-missing') return 'Asociar cada control con un <label for="id"> visible. Usar aria-labelledby si ya existe texto visible; usar aria-describedby solo para ayudas o errores.';
  if (ruleKey === 'button-name' || ruleKey === 'button-name-missing') return 'Agregar nombre accesible al boton. Preferir texto visible; en botones solo icono usar aria-label que describa la accion, por ejemplo "Cerrar modal".';
  if (ruleKey === 'link-name' || ruleKey === 'link-name-missing') return 'Agregar texto de enlace visible y especifico que indique destino o accion. Si es solo icono, usar aria-label que incluya el proposito visible.';
  if (ruleKey === 'link-href-missing') return 'Si el elemento navega, usar <a href="..."> con destino valido. Si ejecuta una accion sin navegar, reemplazarlo por <button type="button"> accesible por teclado.';
  if (ruleKey === 'form-control-multiple-labels') return 'Dejar un solo label programatico asociado al campo. Mover instrucciones, ejemplos y mensajes de error a elementos referenciados con aria-describedby.';
  if (ruleKey === 'label-empty-text') return 'Agregar texto descriptivo al label asociado o eliminarlo si no corresponde; un label vacio no debe ser la unica etiqueta del control.';
  if (ruleKey === 'autocomplete-missing') return 'Agregar un token autocomplete especifico segun el dato solicitado, por ejemplo name, given-name, family-name, email, tel, address-line1 o one-time-code.';
  if (ruleKey === 'required-html5-indicator') return 'Mantener required si aplica, pero agregar una indicacion visible antes del envio, por ejemplo texto "Obligatorio", y asegurar que el error sea anunciado.';
  if (ruleKey === 'contrast-image-background-undetermined') return 'Revisar el contraste sobre la captura real. Si no alcanza 4.5:1 en texto normal, agregar capa solida/semitransparente o cambiar texto/fondo; no depender solo de sombra.';
  if (ruleKey === 'h1-in-header') return 'Usar el h1 para el titulo unico del contenido principal y dejar la marca del header como texto normal, p o span.';
  if (ruleKey === 'content-behind-dialog-accessible') return 'Cuando el dialogo este abierto, ocultar o inhabilitar programaticamente el contenido de fondo con inert/aria-hidden y gestionar el foco dentro del modal.';
  if (ruleKey === 'empty-list-item') return 'Eliminar el <li> vacio. Si se usa solo para separacion o decoracion, mover ese efecto a CSS; las listas deben contener elementos con significado.';
  if (ruleKey === 'aria-required-owned-element') return 'Corregir el patron ARIA: el contenedor debe tener los roles hijos obligatorios (por ejemplo listbox > option). Si no es un widget real, quitar el role ARIA y usar HTML nativo.';
  if (ruleKey === 'aria-widget-name-missing' || ruleKey === 'aria-dialog-name') return 'Agregar nombre accesible al widget con aria-labelledby apuntando a un titulo visible. Usar aria-label solo si no existe texto visible adecuado.';
  if (ruleKey === 'aria-valid-attr-value') return 'Corregir valores y referencias ARIA: los ids de aria-labelledby/aria-controls deben existir, los booleanos deben ser validos y el atributo debe ser permitido para el rol.';
  if (ruleKey === 'scrollable-region-focusable') return 'Hacer enfocable el contenedor desplazable con tabindex="0", agregar nombre accesible si corresponde y comprobar que se pueda desplazar solo con teclado.';
  if (ruleKey === 'table-purpose-review' || ruleKey === 'table-caption-review') return 'Determinar si la tabla es de datos o maquetacion. Si es de datos, agregar caption, th y scope; si es maquetacion, reemplazar por CSS o usar role="presentation".';
  if (ruleKey === 'title-non-interactive') return 'No depender de title para informacion importante. Mostrar el texto de forma visible o asociarlo con aria-describedby a un control relacionado.';
  return 'Corregir el elemento segun el criterio WCAG indicado y validar nuevamente con teclado, lector de pantalla o contraste segun corresponda.';
}
