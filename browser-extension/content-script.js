(function () {
  const PAGE_STATE = 'interactive_state';
  const PAGE_STATE_LABEL = 'Pestaña autenticada';
  const MAX_HTML_SAMPLE = 360;

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  };

  const textOf = (element) => (element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();

  const selectorFor = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return 'document';
    if (element.id) return `#${cssEscape(element.id)}`;
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = sameTagSiblings.indexOf(current) + 1;
      parts.unshift(sameTagSiblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.join(' > ');
  };

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };

  const accessibleName = (element) => {
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const value = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map(textOf)
        .join(' ')
        .trim();
      if (value) return value;
    }
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
    if (element.labels?.length) return Array.from(element.labels).map(textOf).join(' ').trim();
    if (element.alt) return element.alt.trim();
    if (element.title) return element.title.trim();
    return textOf(element).slice(0, 120);
  };

  const inferRole = (element) => {
    const role = element.getAttribute('role');
    if (role) return role;
    const tag = element.tagName.toLowerCase();
    if (tag === 'a' && element.hasAttribute('href')) return 'link';
    if (['button', 'select', 'textarea'].includes(tag)) return tag;
    if (tag === 'input') return element.getAttribute('type') || 'input';
    if (/^h[1-6]$/.test(tag)) return 'heading';
    return 'Nativo';
  };

  const parseWcag = (tags) => {
    const criterionTag = tags.find((tag) => /^wcag\d{3,4}$/.test(tag));
    const levelTag = tags.find((tag) => /^wcag2{0,1}2?a{1,3}$/i.test(tag));
    const criterion = criterionTag
      ? `${criterionTag.slice(4, 5)}.${criterionTag.slice(5, 6)}.${criterionTag.slice(6)}`
      : 'N/A';
    const level = levelTag?.toLowerCase().includes('aaa') ? 'AAA' : levelTag?.toLowerCase().includes('aa') ? 'AA' : 'A';
    return { criterion, level };
  };

  const impactToSeverity = (impact) => {
    if (impact === 'critical') return 'critico';
    if (impact === 'serious') return 'alto';
    if (impact === 'moderate') return 'medio';
    return 'bajo';
  };

  const severityRank = {
    critico: 4,
    alto: 3,
    medio: 2,
    bajo: 1,
  };

  const normalizeRuleId = (ruleId, description = '') => {
    const r = String(ruleId || '').toLowerCase();
    const d = String(description || '').toLowerCase();

    // Extract axe rule name from deque URLs
    const dequeMatch = r.match(/dequeuniversity\.com\/rules\/axe\/[0-9.]+\/([^?)\s]+)/);
    if (dequeMatch && dequeMatch[1]) return dequeMatch[1];
    if (r.startsWith('axe:')) return r.slice(4);

    // Precise ruleId pattern matching (comprehensive - matches worker normalizeRuleLookupKey)
    if (r.includes('duplicate-id') || d.includes('id attribute is not unique')) return 'duplicate-id';
    if (r.includes('html-lang-valid')) return 'html-lang-valid';
    if (r.includes('html-has-lang') || r === 'html-has-lang') return 'html-has-lang';
    if (r.includes('valid-lang') && !r.includes('html')) return 'valid-lang';
    if (r.includes('html-lang-missing') || (d.includes('html') && d.includes('lang') && !d.includes('parts'))) return 'html-lang-missing';
    if (r.includes('aria-dialog-name') || (d.includes('dialog') && d.includes('accessible name'))) return 'aria-dialog-name';
    if (r.includes('aria-required-owned-element') || d.includes('required owned') || d.includes('owned element') || (d.includes('listbox') && d.includes('option'))) return 'aria-required-owned-element';
    if (r.includes('aria-valid-attr-value') || (d.includes('aria attributes') && d.includes('valid values'))) return 'aria-valid-attr-value';
    if (r.includes('aria-allowed-attr') || r.includes('aria-prohibited-attr')) return 'aria-allowed-attr';
    if (r.includes('aria-roles') || r.includes('aria-required-attr') || r.includes('aria-conditional-attr')) return 'aria-roles';
    if (r.includes('scrollable-region-focusable') || r.includes('element_scrollable_tabbable') || (d.includes('scrollable region') && d.includes('keyboard'))) return 'scrollable-region-focusable';
    if (r.includes('h1-in-header') || (d.includes('h1') && d.includes('header'))) return 'h1-in-header';
    if (r.includes('content-behind-dialog-accessible') || (d.includes('content behind') && d.includes('dialog'))) return 'content-behind-dialog-accessible';
    if (r.includes('frame-tested') || r.includes('frame_tested')) return 'frame-tested';
    if (r.includes('iframe-title') || r.includes('h64.1') || r.includes('h64') || r.includes('iframe_title')) return 'iframe-title';
    if (r.includes('color-contrast-enhanced')) return 'color-contrast-enhanced';
    if (r.includes('color-contrast') || d.includes('color contrast') || r.includes('g18.fail') || r.includes('g145.fail')) return 'color-contrast';
    if ((r.includes('main') && (r.includes('landmark') || d.includes('main landmark'))) || r.includes('landmark-one-main') || r.includes('no-main-landmark') || r.includes('aria_main') || r.includes('landmark_main') || (d.includes('landmark') && d.includes('main'))) return 'landmark-main-missing';
    if ((r.includes('nav') && r.includes('landmark')) || (d.includes('landmark') && d.includes('nav')) || r.includes('landmark-nav')) return 'landmark-nav-missing';
    if (r.includes('bypass-missing') || r.includes('bypass') || r.includes('skip-link') || d.includes('skip to main') || d.includes('bypass blocks')) return 'bypass-missing';
    if (r.includes('empty-list-item') || (d.includes('list') && d.includes('empty'))) return 'empty-list-item';
    if (r.includes('link-href-missing') || d.includes('missing href') || r.includes('f55')) return 'link-href-missing';
    if (r.includes('link-name-missing') || r.includes('a_text_purpose') || (r.includes('link') && (d.includes('no text') || d.includes('discernible text') || (d.includes('accessible name') && !d.includes('button'))))) return 'link-name-missing';
    if (r === 'link-name' || (r.includes('link-name') && !r.includes('missing')) || r.includes('h30') || r.includes('e501') || r.includes('link_in_text_block')) return 'link-name';
    if (r.includes('button-name-missing') || (r.includes('button') && d.includes('accessible name') && d.includes('programmatic'))) return 'button-name-missing';
    if (r === 'button-name' || r.includes('h91.button') || r.includes('label_in_name') || r.includes('label-content-name')) return 'button-name';
    if (r.includes('input-name-missing') || r.includes('h65') || r.includes('h91.input') || (d.includes('input') && d.includes('accessible name'))) return 'input-name-missing';
    if (r.includes('select-name') || r.includes('h91.select.name')) return 'input-name-missing';
    if (r.includes('multiple-labels') || r.includes('form-control-multiple-labels') || (r.includes('label') && d.includes('more than one'))) return 'form-control-multiple-labels';
    if (r.includes('label-empty-text') || (r.includes('label') && d.includes('empty'))) return 'label-empty-text';
    if (r.includes('autocomplete-valid') || r.includes('autocomplete')) return 'autocomplete-missing';
    if (r.includes('required-html5-indicator') || r.includes('required-html5-attribute') || (d.includes('required') && d.includes('html5'))) return 'required-html5-indicator';
    if (r.includes('contrast-image-background') || r.includes('f24.fgcolour') || r.includes('bgimage') || (d.includes('contrast') && d.includes('image background'))) return 'contrast-image-background-undetermined';
    if (r.includes('table-purpose-review') || d.includes('unknown table') || d.includes('determine if the table') || r.includes('h63') || r.includes('h51') || r.includes('table_headers')) return 'table-purpose-review';
    if (r.includes('title-non-interactive') || (d.includes('title') && d.includes('non-interactive'))) return 'title-non-interactive';
    if (r.includes('image-alt') || r.includes('img_alt') || r.includes('h37') || r.includes('h45') || r.includes('wcag20_img_hasalt')) return 'image-alt';
    if (r.includes('input-image-alt') || r.includes('h36.2') || r.includes('input.image')) return 'input-image-alt';
    if (r.includes('document-title') || r.includes('doc_title')) return 'document-title';
    if (r.includes('target-size') || r.includes('target_size')) return 'target-size';
    if (r.includes('focus-visible') || r.includes('focus_visible')) return 'focus-visible';
    if (r === 'label' || (r.includes('label') && !r.includes('aria') && !r.includes('labelledby') && !r.includes('multiple') && !r.includes('empty'))) return 'label';
    if (r.includes('h91.select.value')) return 'select-value';
    if (r.includes('h85.2')) return 'select-optgroup';
    if (r.includes('h44.notformcontrol') || r.includes('label-not-form-control')) return 'label-not-form-control';
    if (r.includes('h39.3.nocaption') || r.includes('table-caption-review')) return 'table-caption-review';
    if (r.includes('h67.2') || r.includes('image-ignored-review')) return 'image-ignored-review';
    if (r.includes('1_4_10') || r.includes('reflow')) return 'reflow-fixed-position';
    if (r.includes('h42') || r.includes('heading-order') || r.includes('heading_markup')) return 'heading-markup-review';
    if (r.includes('h91.textarea.name') || r.includes('textarea-name')) return 'textarea-name';
    if (r.includes('f68') || r.includes('h71.3') || r.includes('h44.2') || r.includes('form-field-label-missing') || r.includes('h71') || r.includes('h32')) return 'form-field-label-missing';
    if (r.includes('h48') || r.includes('list_markup')) return 'empty-list-item';
    if (r.includes('g1.1') || r.includes('skip_link')) return 'bypass-missing';
    if (r.includes('aria.documentlanguage') || r.includes('rpt_elem_lang_empty') || r.includes('html_lang')) return 'html-lang-missing';
    if (r.includes('region') && !r.includes('scrollable')) return 'region';
    if (r.includes('aria-widget-name-missing') || r.includes('aria_widget_labelled') || (d.includes('aria') && d.includes('accessible name') && !d.includes('button') && !d.includes('input') && !d.includes('link'))) return 'aria-widget-name-missing';

    return r || 'manual-review';
  };

  // Política de precisión — espejo de worker/src/classificationPolicy.ts:
  // solo las reglas determinísticas (falso positivo ~0) se reportan como
  // "error confirmado"; el resto baja a revisión para proteger la precisión.
  const HIGH_CONFIDENCE_RULES = new Set([
    'duplicate-id', 'image-alt', 'button-name', 'label',
    'color-contrast', 'color-contrast-enhanced', 'link-name', 'input-image-alt',
    'html-has-lang', 'html-lang-valid', 'html-lang-missing',
    'document-title', 'select-name', 'aria-roles', 'aria-valid-attr-value',
    'definition-list', 'dlitem', 'td-headers-attr', 'empty-heading',
  ]);

  const statusForCategory = (category, normalizedKey) =>
    category === 'violation' && HIGH_CONFIDENCE_RULES.has(normalizedKey) ? 'confirmed' : 'needs_review';

  // Full Spanish names + fixes — mirrors worker wcagRules.ts ruleMapping + extraRuleMapping
  const RULE_DETAILS = {
    'image-alt':                          { nameEs: 'Contenido no textual',                             criterion: '1.1.1',          level: 'A',   role: 'Compartido',     suggestedFix: 'Si la imagen transmite información, agregar alt descriptivo y breve (máximo 150 caracteres). Si es decorativa, usar alt="" y no agregar aria-hidden salvo en svgs decorativos.' },
    'input-image-alt':                    { nameEs: 'Contenido no textual',                             criterion: '1.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar alt al input[type=image] con el texto que describe la acción del botón (no la imagen), por ejemplo alt="Buscar".' },
    'image-ignored-review':               { nameEs: 'Contenido no textual - imagen ignorada',           criterion: '1.1.1',          level: 'A',   role: 'Compartido',     suggestedFix: 'Confirmar si la imagen es decorativa. Si transmite información, quitar aria-hidden y agregar texto alternativo descriptivo.' },
    'color-contrast':                     { nameEs: 'Contraste mínimo',                                 criterion: '1.4.3',          level: 'AA',  role: 'Diseñador UX/UI', suggestedFix: 'Ajustar los colores de texto y fondo para alcanzar una relacion de contraste de al menos 4.5:1 en texto normal o 3:1 en texto grande. Usar herramientas como WebAIM Contrast Checker para verificar.' },
    'color-contrast-enhanced':            { nameEs: 'Contraste mejorado',                               criterion: '1.4.6',          level: 'AAA', role: 'Diseñador UX/UI', suggestedFix: 'Para nivel AAA ajustar contraste a mínimo 7:1 en texto normal y 4.5:1 en texto grande. Especialmente critico para usuarios con baja vision severa.' },
    'contrast-image-background-undetermined': { nameEs: 'Contraste sobre fondo imagen (revisión)',      criterion: '1.4.3',          level: 'AA',  role: 'Diseñador UX/UI', suggestedFix: 'Revisar el contraste sobre la captura real. Si no alcanza 4.5:1 en texto normal, agregar capa solida/semitransparente o cambiar texto/fondo; no depender solo de sombra.' },
    'reflow-fixed-position':              { nameEs: 'Reflow - posicion fija',                           criterion: '1.4.10',         level: 'AA',  role: 'Desarrollador',  suggestedFix: 'Verificar que el elemento fijo no obligue a desplazamiento en dos dimensiones y sea usable a 320 CSS px de ancho.' },
    'region':                             { nameEs: 'Información y relaciones - regiones',              criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Ubicar el contenido relevante dentro de landmarks semánticos como main, nav, header, footer o regiones con nombre accesible.' },
    'empty-list-item':                    { nameEs: 'Elemento de lista vacio',                          criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Eliminar el <li> vacio. Si se usa solo para separacion o decoracion, mover ese efecto a CSS; las listas deben contener elementos con significado.' },
    'heading-markup-review':              { nameEs: 'Información y relaciones - encabezado visual',     criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Si el texto funciona como encabezado, usar el elemento h1-h6 correspondiente y mantener una jerarquía logica.' },
    'empty-heading':                      { nameEs: 'Encabezado vacío',                                 criterion: '2.4.6',          level: 'AA',  role: 'Compartido',     suggestedFix: 'Agregar texto descriptivo al encabezado o eliminarlo si no corresponde. Un lector de pantalla anuncia "encabezado" sin contenido. Si el título llega por datos dinámicos, validar que nunca se renderice vacío.' },
    'duplicate-headings':                 { nameEs: 'Encabezados duplicados',                           criterion: '2.4.6',          level: 'AA',  role: 'Redactor UX',    suggestedFix: 'Varios encabezados del mismo nivel comparten texto idéntico: quien navega por encabezados no puede distinguir las secciones. Diferenciarlos con texto específico.' },
    'table-purpose-review':               { nameEs: 'Propósito de tabla no claro',                      criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Determinar si la tabla es de datos o maquetación. Si es de datos, agregar caption, th y scope; si es maquetación, reemplazar por CSS o usar role="presentation".' },
    'table-caption-review':               { nameEs: 'Información y relaciones - caption de tabla',      criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Si es una tabla de datos, agregar un caption que identifique claramente el propósito de la tabla.' },
    'select-optgroup':                    { nameEs: 'Información y relaciones - grupos de opciones',    criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Si la lista contiene grupos de opciones relacionadas, agruparlas con optgroup y etiquetas descriptivas.' },
    'label-not-form-control':             { nameEs: 'Información y relaciones - label mal asociado',    criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Corregir el atributo for para que apunte al id de un control de formulario real o asociar el texto mediante aria-describedby si es ayuda.' },
    'form-field-label-missing':           { nameEs: 'Información y relaciones - campo sin etiqueta',    criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Etiquetar el campo con label asociado, title, aria-label o aria-labelledby según corresponda.' },
    'content-behind-dialog-accessible':   { nameEs: 'Contenido detras del diálogo accesible',           criterion: '1.3.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Cuando el diálogo este abierto, ocultar o inhabilitar programáticamente el contenido de fondo con inert/aria-hidden y gestionar el foco dentro del modal.' },
    'autocomplete-missing':               { nameEs: 'Identificar propósito de entrada',                 criterion: '1.3.5',          level: 'AA',  role: 'Desarrollador',  suggestedFix: 'Agregar un token autocomplete específico según el dato solicitado, por ejemplo name, given-name, family-name, email, tel, address-line1 o one-time-code.' },
    'bypass':                             { nameEs: 'Evitar bloques',                                   criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar antes del primer elemento interactivo un enlace "Saltar al contenido" visible al foco que apunte a id="main-content". Confirmar que el destino existe y recibe foco.' },
    'bypass-missing':                     { nameEs: 'Método para saltar bloques',                       criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar antes del encabezado un enlace "Saltar al contenido principal" que apunte a #main-content, sea visible al recibir foco y funcione con teclado.' },
    'landmark-main-missing':              { nameEs: 'Evitar bloques (main landmark)',                   criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Envolver el contenido principal con un único <main id="main-content"> o role="main"; no incluir header, nav ni footer repetitivos dentro del main.' },
    'landmark-nav-missing':               { nameEs: 'Evitar bloques (nav landmark)',                    criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Marcar la navegación principal con <nav aria-label="Navegación principal"> o role="navigation" con nombre accesible cuando haya mas de una navegación.' },
    'iframe-title':                       { nameEs: 'Evitar bloques - título de iframe',                criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar un atributo title no vacio al iframe que describa su contenido o propósito.' },
    'h1-in-header':                       { nameEs: 'H1 dentro del encabezado',                        criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Usar el h1 para el título único del contenido principal y dejar la marca del header como texto normal, p o span.' },
    'document-title':                     { nameEs: 'Titulado de páginas',                              criterion: '2.4.2',          level: 'A',   role: 'Redactor UX',    suggestedFix: 'Definir un title único y descriptivo con formato "Nombre página | Sistema" (máximo 60-70 caracteres). Actualizar en cada vista de SPA.' },
    'link-name':                          { nameEs: 'Propósito de los enlaces',                         criterion: '2.4.4',          level: 'A',   role: 'Redactor UX',    suggestedFix: 'Agregar texto visible descriptivo al enlace. Si solo tiene icono, usar aria-label con el propósito real. Evitar textos genericos como "click aqui" o "leer mas".' },
    'link-name-missing':                  { nameEs: 'Enlace sin texto o nombre accesible',              criterion: '2.4.4',          level: 'A',   role: 'Redactor UX',    suggestedFix: 'Agregar texto de enlace visible y específico que indique destino o acción. Si es solo icono, usar aria-label que incluya el propósito visible.' },
    'focus-visible':                      { nameEs: 'Foco visible',                                     criterion: '2.4.7',          level: 'AA',  role: 'Compartido',     suggestedFix: 'Definir :focus-visible con outline mínimo de 2px de contraste 3:1, sin eliminar el outline del navegador sin reemplazo. Evitar outline:none sin definir estilo alternativo.' },
    'link-href-missing':                  { nameEs: 'Enlace sin href',                                  criterion: '2.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Si el elemento navega, usar <a href="..."> con destino válido. Si ejecuta una acción sin navegar, reemplazarlo por <button type="button"> accesible por teclado.' },
    'scrollable-region-focusable':        { nameEs: 'Teclado - region desplazable',                     criterion: '2.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Hacer enfocable el contenedor desplazable con tabindex="0", agregar nombre accesible si corresponde y comprobar que se pueda desplazar solo con teclado.' },
    'target-size':                        { nameEs: 'Tamano del area de interacción mínimo',            criterion: '2.5.8',          level: 'AA',  role: 'Diseñador UX/UI', suggestedFix: 'Asegurar que areas de interacción tengan mínimo 24x24 CSS px (WCAG 2.2 AA) o preferiblemente 44x44 CSS px para mejor usabilidad movil.' },
    'label':                              { nameEs: 'Etiquetas o instrucciones',                        criterion: '3.3.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Asociar cada control con label[for="id"] visible. Priorizar texto visible sobre aria-label. Usar aria-describedby para instrucciones adicionales, no como etiqueta principal.' },
    'form-control-multiple-labels':       { nameEs: 'Etiquetas múltiples por control',                  criterion: '3.3.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Dejar un solo label programático asociado al campo. Mover instrucciones, ejemplos y mensajes de error a elementos referenciados con aria-describedby.' },
    'label-empty-text':                   { nameEs: 'Etiqueta vacia',                                   criterion: '3.3.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar texto descriptivo al label asociado o eliminarlo si no corresponde; un label vacio no debe ser la única etiqueta del control.' },
    'required-html5-indicator':           { nameEs: 'Indicación de campos requeridos',                  criterion: '3.3.2',          level: 'A',   role: 'Compartido',     suggestedFix: 'Mantener required si aplica, pero agregar una indicación visible antes del envio, por ejemplo texto "Obligatorio", y asegurar que el error sea anunciado.' },
    'title-non-interactive':              { nameEs: 'Title en elemento no interactivo',                 criterion: '3.3.2',          level: 'A',   role: 'Compartido',     suggestedFix: 'No depender de title para información importante. Mostrar el texto de forma visible o asociarlo con aria-describedby a un control relacionado.' },
    'html-has-lang':                      { nameEs: 'Idioma de la página',                              criterion: '3.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar lang="es" o el BCP 47 correspondiente en el elemento html. Para contenido peruano usar lang="es-PE".' },
    'html-lang-valid':                    { nameEs: 'Idioma de la página (Valido)',                     criterion: '3.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Verificar que el código de idioma sea un BCP 47 válido, por ejemplo es, es-PE, en, en-US.' },
    'html-lang-missing':                  { nameEs: 'Idioma de la página',                              criterion: '3.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar en el elemento html un atributo lang válido según el idioma principal, por ejemplo lang="es". Si hay fragmentos en otro idioma, marcarlos con lang propio.' },
    'valid-lang':                         { nameEs: 'Idioma de las partes de la página',                criterion: '3.1.2',          level: 'AA',  role: 'Compartido',     suggestedFix: 'Usar codigos de idioma BCP 47 válidos en todos los atributos lang de la página.' },
    'button-name':                        { nameEs: 'Nombre, función y valor',                          criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar nombre accesible al botón: texto visible preferente, aria-label para botones icono o aria-labelledby apuntando a texto existente.' },
    'button-name-missing':                { nameEs: 'Botón sin nombre accesible',                       criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar nombre accesible al botón. Preferir texto visible; en botones solo icono usar aria-label que describa la acción, por ejemplo "Cerrar modal".' },
    'input-name-missing':                 { nameEs: 'Campo sin nombre accesible',                       criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Asociar cada control con un <label for="id"> visible. Usar aria-labelledby si ya existe texto visible; usar aria-describedby solo para ayudas o errores.' },
    'aria-allowed-attr':                  { nameEs: 'Nombre, función y valor',                          criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Eliminar atributos ARIA no permitidos para el rol del elemento. Consultar la especificacion ARIA para ver que atributos acepta cada rol y preferir HTML nativo.' },
    'aria-roles':                         { nameEs: 'Nombre, función y valor',                          criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Usar solo roles ARIA válidos de la especificacion WAI-ARIA 1.2. Preferir elementos HTML nativos con semántica equivalente cuando existan.' },
    'duplicate-id':                       { nameEs: 'Nombre, función y valor - ids únicos',             criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Asignar ids únicos en toda la página incluyendo componentes reutilizables. Actualizar todos los for, aria-labelledby, aria-controls que referencian el id duplicado.' },
    'aria-required-owned-element':        { nameEs: 'Widget ARIA sin elemento hijo requerido',          criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Corregir el patron ARIA: el contenedor debe tener los roles hijos obligatorios (por ejemplo listbox > option). Si no es un widget real, quitar el role ARIA y usar HTML nativo.' },
    'aria-widget-name-missing':           { nameEs: 'Widget ARIA sin nombre accesible',                 criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar nombre accesible al widget con aria-labelledby apuntando a un título visible. Usar aria-label solo si no existe texto visible adecuado.' },
    'aria-dialog-name':                   { nameEs: 'Nombre, función y valor - diálogo sin nombre',     criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar un nombre accesible al diálogo usando aria-labelledby con un título visible existente o aria-label descriptivo.' },
    'aria-valid-attr-value':              { nameEs: 'Valores ARIA válidos',                             criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Corregir atributos ARIA para que tengan valores válidos y referencias existentes, especialmente aria-labelledby.' },
    'select-value':                       { nameEs: 'Nombre, función y valor - select sin valor',       criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Verificar que el select exponga nombre y valor actual a la API de accesibilidad mediante label, option seleccionado y estado válido.' },
    'textarea-name':                      { nameEs: 'Nombre, función y valor - textarea sin nombre',    criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar un nombre accesible al textarea con label, title, aria-label o aria-labelledby válido.' },
    'frame-tested':                       { nameEs: 'Contenido embebido no evaluado',                   criterion: 'Revisión manual', level: 'A',  role: 'Compartido',     suggestedFix: 'Escanear directamente la URL del iframe o revisar manualmente su contenido para confirmar incumplimientos WCAG aplicables.' },
  };

  const getRuleDetails = (ruleId, description = '') => {
    const key = normalizeRuleId(ruleId, description);
    return RULE_DETAILS[key] || null;
  };

  const suggestedFixForRule = (ruleId, description = '') => {
    const details = getRuleDetails(ruleId, description);
    if (details && details.suggestedFix) return details.suggestedFix;
    const k = normalizeRuleId(ruleId, description);
    if (k.includes('color-contrast')) return 'Ajustar los colores de texto y fondo para cumplir contraste WCAG AA: 4.5:1 en texto normal o 3:1 en texto grande.';
    if (k.includes('image-alt')) return 'Si la imagen transmite información, agregar alt descriptivo y breve. Si es decorativa, dejar alt="" y evitar aria-hidden en imagenes informativas.';
    if (k.includes('aria')) return 'Corregir nombre, rol, valor y referencias ARIA. Preferir HTML nativo cuando sea posible y validar con lector de pantalla o arbol de accesibilidad.';
    const fallback = String(description || '');
    return fallback.length > 30
      ? 'Revisar el elemento concreto y aplicar la correccion indicada por el criterio WCAG asociado.'
      : 'Corregir el elemento según el criterio WCAG indicado y validar nuevamente con teclado, lector de pantalla o contraste según corresponda.';
  };

  const querySelectorSafe = (selector) => {
    try {
      return selector ? document.querySelector(selector) : null;
    } catch {
      return null;
    }
  };

  const visualRectFor = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return {
      x: Math.max(0, Math.round(box.x)),
      y: Math.max(0, Math.round(box.y)),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  };

  const buildFinding = (rule, node, category) => {
    const { criterion, level } = parseWcag(rule.tags || []);
    const target = Array.isArray(node.target) ? node.target.join(', ') : selectorFor(node.element);
    let rect = null;
    try {
      const targetElement = Array.isArray(node.target) && node.target[0] ? document.querySelector(node.target[0]) : null;
      rect = visualRectFor(targetElement);
    } catch {
      rect = null;
    }
    const normKey = normalizeRuleId(rule.id, rule.description || rule.help);
    const status = statusForCategory(category, normKey);
    const details = getRuleDetails(rule.id, rule.description || rule.help);
    const rawDesc = (rule.description || rule.help || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
    const nameEs = (details && details.nameEs) ? details.nameEs : (rule.help || rule.id);
    const ruleCriterion = (details && details.criterion) || criterion;
    const ruleLevel = (details && details.level) || level;
    const elementFix = (node.any || []).map((item) => item.message).filter(Boolean).join('. ')
      || (node.all || []).map((item) => item.message).filter(Boolean).join('. ')
      || '';
    return {
      tool: 'axe-extension',
      ruleId: rule.id,
      normalizedRuleId: normKey,
      category,
      sourceCategory: category,
      criterion: ruleCriterion,
      wcagCriterion: ruleCriterion,
      level: ruleLevel,
      wcagLevel: ruleLevel,
      nameEs,
      disability: [],
      role: (details && details.role) || 'Desarrollador',
      severity: impactToSeverity(rule.impact),
      findingStatus: status,
      status,
      statusLabel: status === 'confirmed' ? 'Confirmado' : 'Requiere revisión',
      pageState: PAGE_STATE,
      pageStateLabel: PAGE_STATE_LABEL,
      description: rawDesc || rule.id,
      elementHtml: (node.html || '').slice(0, MAX_HTML_SAMPLE),
      selector: target || 'document',
      screenshotUrl: '',
      suggestedFix: suggestedFixForRule(rule.id, rule.description || rule.help || ''),
      elementFix: elementFix || undefined,
      resolutionArticle: ruleCriterion && ruleCriterion !== 'N/A' && ruleCriterion !== 'Revisión manual' ? `Anexo 1 - Criterio ${ruleCriterion}` : 'ISO/IEC 40500 / WCAG 2.2',
      wcagUrl: rule.helpUrl || '',
      affectedElements: [target || 'document'],
      affectedHtmlSamples: node.html ? [node.html.slice(0, MAX_HTML_SAMPLE)] : [],
      visualRect: rect,
    };
  };

  const buildHeuristicFinding = ({
    ruleId,
    category = 'alert',
    criterion,
    level = 'A',
    nameEs,
    description,
    element,
    selector,
    severity = 'medio',
    role = 'Desarrollador',
    suggestedFix,
  }) => {
    const targetElement = element || querySelectorSafe(selector);
    const target = selector || selectorFor(targetElement);
    const status = statusForCategory(category, normalizeRuleId(ruleId, description || nameEs));
    return {
      tool: 'heuristic-dom-extension',
      ruleId,
      normalizedRuleId: normalizeRuleId(ruleId, description || nameEs),
      category,
      sourceCategory: category,
      criterion,
      wcagCriterion: criterion,
      level,
      wcagLevel: level,
      nameEs: nameEs || ruleId,
      disability: [],
      role,
      severity,
      findingStatus: status,
      status,
      statusLabel: status === 'confirmed' ? 'Confirmado' : 'Requiere revisión',
      pageState: PAGE_STATE,
      pageStateLabel: PAGE_STATE_LABEL,
      description,
      elementHtml: targetElement?.outerHTML ? targetElement.outerHTML.slice(0, MAX_HTML_SAMPLE) : '',
      selector: target || 'document',
      screenshotUrl: '',
      suggestedFix: suggestedFix || suggestedFixForRule(ruleId, description || nameEs || ''),
      resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2',
      wcagUrl: '',
      affectedElements: [target || 'document'],
      affectedHtmlSamples: targetElement?.outerHTML ? [targetElement.outerHTML.slice(0, MAX_HTML_SAMPLE)] : [],
      visualRect: visualRectFor(targetElement),
    };
  };

  const collectHeuristicDomFindings = () => {
    const findings = [];
    const push = (finding) => findings.push(buildHeuristicFinding(finding));
    const interactiveSelector = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      'summary',
      '[role="button"]',
      '[role="link"]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(',');

    if (!document.documentElement.getAttribute('lang')) {
      push({
        ruleId: 'html-lang-missing',
        category: 'violation',
        criterion: '3.1.1',
        level: 'A',
        nameEs: 'Idioma de página no definido',
        description: 'El elemento html no tiene atributo lang definido.',
        element: document.documentElement,
        severity: 'alto',
        suggestedFix: 'Agregar lang="es" o el idioma principal correcto en el elemento html.',
      });
    }

    if (!document.querySelector('main,[role="main"]')) {
      push({
        ruleId: 'landmark-main-missing',
        category: 'alert',
        criterion: '2.4.1',
        level: 'A',
        nameEs: 'No hay landmark main',
        description: 'La página no identifica explicitamente el contenido principal con main o role="main".',
        element: document.body,
        severity: 'medio',
        suggestedFix: 'Agregar un elemento main o role="main" alrededor del contenido principal.',
      });
    }

    if (!document.querySelector('nav,[role="navigation"]')) {
      push({
        ruleId: 'landmark-nav-missing',
        category: 'alert',
        criterion: '2.4.1',
        level: 'A',
        nameEs: 'No hay landmark nav',
        description: 'La página no identifica explicitamente la navegación principal con nav o role="navigation".',
        element: document.body,
        severity: 'medio',
        suggestedFix: 'Encerrar la navegación principal en nav o agregar role="navigation".',
      });
    }

    // Encabezados duplicados (2.4.6) — regla que axe no tiene (paridad con ARC
    // Toolkit): mismo nivel + mismo texto accesible confunde la navegación por
    // encabezados. Los VACÍOS los detecta axe (empty-heading, confirmada).
    const headingTextCount = new Map();
    for (const heading of Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'))) {
      if (!isVisible(heading) || heading.getAttribute('aria-hidden') === 'true') continue;
      const name = accessibleName(heading);
      if (!name) continue;
      const level = heading.getAttribute('aria-level') || (heading.tagName.match(/^H([1-6])$/i) || [])[1] || '2';
      const key = 'H' + level + '::' + name.toLowerCase().slice(0, 120);
      const entry = headingTextCount.get(key) || { count: 0, first: heading };
      entry.count += 1;
      headingTextCount.set(key, entry);
    }
    for (const [key, entry] of headingTextCount.entries()) {
      if (entry.count < 2) continue;
      const label = (key.split('::')[1] || '').slice(0, 80);
      push({
        ruleId: 'duplicate-headings',
        category: 'alert',
        criterion: '2.4.6',
        level: 'AA',
        nameEs: 'Encabezados duplicados',
        description: 'Hay ' + entry.count + ' encabezados del mismo nivel con el texto idéntico "' + label + '".',
        element: entry.first,
        severity: 'medio',
        suggestedFix: 'Diferenciar los encabezados repetidos con texto específico para que cada sección sea distinguible al navegar por encabezados.',
      });
    }

    const skipLink = Array.from(document.querySelectorAll('a[href^="#"]')).find((element) => {
      const text = textOf(element).toLowerCase();
      const href = element.getAttribute('href') || '';
      return text.includes('saltar') || text.includes('contenido') || text.includes('skip') || href.includes('main');
    });
    if (!skipLink && document.querySelectorAll('a[href],button,input,select,textarea').length > 12) {
      push({
        ruleId: 'bypass-missing',
        category: 'manual_check',
        criterion: '2.4.1',
        level: 'A',
        nameEs: 'Falta método para saltar bloques',
        description: 'La página parece no tener un enlace para saltar al contenido principal.',
        element: document.body,
        severity: 'medio',
        suggestedFix: 'Agregar un enlace visible al foco que permita saltar directamente al contenido principal.',
      });
    }

    document.querySelectorAll('li').forEach((element) => {
      if (!isVisible(element) || element.getAttribute('aria-hidden') === 'true') return;
      if (textOf(element) || element.querySelector(interactiveSelector)) return;
      push({
        ruleId: 'empty-list-item',
        category: 'alert',
        criterion: '1.3.1',
        level: 'A',
        nameEs: 'Elemento de lista vacio',
        description: 'La lista contiene un li vacio o sin contenido discernible.',
        element,
        severity: 'medio',
        suggestedFix: 'Eliminar el li vacio o marcarlo como decorativo si no transmite información.',
      });
    });

    document.querySelectorAll('a:not([href])').forEach((element) => {
      if (!isVisible(element)) return;
      const cursor = window.getComputedStyle(element).cursor;
      if (!element.getAttribute('onclick') && cursor !== 'pointer') return;
      push({
        ruleId: 'link-href-missing',
        category: 'alert',
        criterion: '2.1.1',
        level: 'A',
        nameEs: 'Enlace sin href',
        description: 'Un elemento a parece interactivo pero no tiene atributo href.',
        element,
        severity: 'medio',
        suggestedFix: 'Usar href válido para enlaces o cambiarlo por button si ejecuta una acción.',
      });
    });

    document.querySelectorAll('a[href],[role="link"]').forEach((element) => {
      if (!isVisible(element) || accessibleName(element)) return;
      push({
        ruleId: 'link-name-missing',
        category: 'violation',
        criterion: '2.4.4',
        level: 'A',
        nameEs: 'Enlace sin texto',
        description: 'El enlace no tiene texto ni nombre accesible discernible.',
        element,
        severity: 'alto',
        suggestedFix: 'Agregar texto visible o un nombre accesible que describa el destino del enlace.',
      });
    });

    document.querySelectorAll('button,[role="button"]').forEach((element) => {
      if (!isVisible(element) || accessibleName(element)) return;
      push({
        ruleId: 'button-name-missing',
        category: 'violation',
        criterion: '4.1.2',
        level: 'A',
        nameEs: 'Botón sin nombre accesible',
        description: 'El control con función de botón no tiene nombre programático.',
        element,
        severity: 'alto',
        suggestedFix: 'Agregar texto visible, aria-label o aria-labelledby que describa la acción.',
      });
    });

    document.querySelectorAll('input,select,textarea').forEach((element) => {
      const type = (element.getAttribute('type') || '').toLowerCase();
      if (type === 'hidden' || !isVisible(element)) return;
      if (!accessibleName(element)) {
        push({
          ruleId: 'input-name-missing',
          category: 'violation',
          criterion: '4.1.2',
          level: 'A',
          nameEs: 'Campo sin nombre accesible',
          description: 'El campo de formulario no tiene nombre accesible.',
          element,
          severity: 'alto',
          suggestedFix: 'Asociar un label visible con for/id o usar aria-labelledby si el texto ya existe.',
        });
      }
      if (element.required) {
        push({
          ruleId: 'required-html5-indicator',
          category: 'manual_check',
          criterion: '3.3.2',
          level: 'A',
          nameEs: 'Required indicado por HTML5',
          description: 'El campo usa required para validacion nativa; verificar que el requisito sea visible y comprensible.',
          element,
          severity: 'bajo',
          suggestedFix: 'Mostrar visualmente que el campo es obligatorio y mantener required/aria-required de forma coherente.',
        });
      }
      if (['input', 'select', 'textarea'].includes(element.tagName.toLowerCase()) && !element.getAttribute('autocomplete')) {
        const name = `${accessibleName(element)} ${element.id || ''} ${element.name || ''}`.toLowerCase();
        if (/(nombre|apellido|dni|documento|telefono|tel|correo|email|direccion|postal|ciudad|pais|departamento|provincia|distrito)/.test(name)) {
          push({
            ruleId: 'autocomplete-missing',
            category: 'alert',
            criterion: '1.3.5',
            level: 'AA',
            nameEs: 'Autocomplete faltante',
            description: 'Un campo que solicita datos del usuario no tiene autocomplete específico.',
            element,
            severity: 'medio',
            suggestedFix: 'Agregar autocomplete apropiado según el propósito del campo, por ejemplo name, email, tel o address-line1.',
          });
        }
      }
      if (element.labels && element.labels.length > 1) {
        push({
          ruleId: 'form-control-multiple-labels',
          category: 'alert',
          criterion: '3.3.2',
          level: 'A',
          nameEs: 'Control con múltiples etiquetas',
          description: 'El control tiene mas de un label asociado.',
          element,
          severity: 'medio',
          suggestedFix: 'Mantener un solo label programático y mover ayudas adicionales a aria-describedby.',
        });
      }
    });

    const requiredChildrenByRole = {
      listbox: ['option'],
      menu: ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
      menubar: ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
      radiogroup: ['radio'],
      tablist: ['tab'],
      tree: ['treeitem'],
      grid: ['row'],
      row: ['cell', 'gridcell', 'columnheader', 'rowheader'],
    };
    Object.entries(requiredChildrenByRole).forEach(([role, children]) => {
      document.querySelectorAll(`[role="${role}"]`).forEach((element) => {
        if (!isVisible(element)) return;
        const hasRequiredChild = children.some((childRole) => element.querySelector(`[role="${childRole}"]`));
        if (hasRequiredChild) return;
        push({
          ruleId: 'aria-required-owned-element',
          category: 'violation',
          criterion: '4.1.2',
          level: 'A',
          nameEs: 'Widget ARIA sin elemento requerido',
          description: `El rol ${role} requiere elementos hijos con rol: ${children.join(', ')}.`,
          element,
          severity: 'alto',
          suggestedFix: 'Agregar los roles hijos requeridos o usar elementos HTML nativos que expresen la relacion correctamente.',
        });
      });
    });

    document.querySelectorAll('[role="listbox"],[role="combobox"],[role="menu"],[role="radiogroup"],[role="tablist"],[role="tree"],[role="grid"],[role="dialog"],[role="alertdialog"]').forEach((element) => {
      if (!isVisible(element) || accessibleName(element)) return;
      push({
        ruleId: 'aria-widget-name-missing',
        category: 'violation',
        criterion: '4.1.2',
        level: 'A',
        nameEs: 'Widget ARIA sin nombre accesible',
        description: 'Un widget ARIA no tiene nombre accesible programático.',
        element,
        severity: 'alto',
        suggestedFix: 'Agregar aria-label o aria-labelledby apuntando a un título visible.',
      });
    });

    document.querySelectorAll('table').forEach((element) => {
      if (!isVisible(element)) return;
      const role = (element.getAttribute('role') || '').toLowerCase();
      if (role === 'presentation' || role === 'none') return;
      if (element.querySelector('caption,th') || element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')) return;
      push({
        ruleId: 'table-purpose-review',
        category: 'manual_check',
        criterion: '1.3.1',
        level: 'A',
        nameEs: 'Propósito de tabla no claro',
        description: 'No se puede determinar si la tabla es de datos o de maquetación.',
        element,
        severity: 'medio',
        suggestedFix: 'Si es tabla de datos, agregar th/caption. Si es maquetación, reemplazar por CSS o usar role="presentation".',
      });
    });

    document.querySelectorAll('[title]').forEach((element) => {
      if (!isVisible(element) || element.matches(interactiveSelector)) return;
      push({
        ruleId: 'title-non-interactive',
        category: 'alert',
        criterion: '3.3.2',
        level: 'A',
        nameEs: 'Title en elemento no interactivo',
        description: 'Un elemento no interactivo usa title; puede no estar disponible para teclado o tecnologias de asistencia.',
        element,
        severity: 'bajo',
        suggestedFix: 'Mover la información a texto visible o a una descripción programatica adecuada.',
      });
    });

    Array.from(document.querySelectorAll('*')).slice(0, 800).forEach((element) => {
      if (!isVisible(element) || !textOf(element)) return;
      const style = window.getComputedStyle(element);
      if (!style.backgroundImage || style.backgroundImage === 'none') return;
      push({
        ruleId: 'contrast-image-background-undetermined',
        category: 'manual_check',
        criterion: '1.4.3',
        level: 'AA',
        nameEs: 'Contraste sobre imagen no determinado',
        description: 'El contraste del texto sobre una imagen de fondo requiere revisión humana.',
        element,
        severity: 'medio',
        role: 'Disenador UX/UI',
        suggestedFix: 'Verificar contraste real sobre la imagen y agregar capa solida o ajustar colores si no cumple 4.5:1.',
      });
    });

    const idMap = new Map();
    document.querySelectorAll('[id]').forEach((element) => {
      const id = element.id;
      if (!id) return;
      idMap.set(id, [...(idMap.get(id) || []), element]);
    });
    idMap.forEach((elements) => {
      if (elements.length < 2) return;
      elements.forEach((element) => {
        push({
          ruleId: 'duplicate-id',
          category: 'violation',
          criterion: '4.1.2',
          level: 'A',
          nameEs: 'ID duplicado',
          description: `El id "${element.id}" aparece mas de una vez en la página.`,
          element,
          severity: 'alto',
          suggestedFix: 'Asignar ids únicos y actualizar las referencias for, aria-labelledby o aria-controls.',
        });
      });
    });

    document.querySelectorAll('iframe').forEach((element) => {
      if (!isVisible(element)) return;
      const title = (element.getAttribute('title') || '').trim();
      if (!title) {
        push({
          ruleId: 'iframe-title',
          category: 'violation',
          criterion: '2.4.1',
          level: 'A',
          nameEs: 'Iframe sin título',
          description: 'El iframe no tiene atributo title que describa su contenido o propósito a lectores de pantalla.',
          element,
          severity: 'alto',
          suggestedFix: 'Agregar title descriptivo al iframe, por ejemplo title="Mapa de ubicacion de la oficina" o title="Video tutorial de registro".',
        });
      } else {
        push({
          ruleId: 'frame-tested',
          category: 'manual_check',
          criterion: 'Revisión manual',
          level: 'A',
          nameEs: 'Contenido de iframe sin evaluar',
          description: 'El iframe "' + title + '" tiene título pero su contenido interno no puede ser auditado automaticamente desde la extension.',
          element,
          severity: 'medio',
          suggestedFix: 'Abrir la URL del iframe directamente y ejecutar el escaner sobre ella, o revisar manualmente contraste, teclado y texto alternativo dentro del iframe.',
        });
      }
    });

    return findings.slice(0, 400);
  };

  // IBM Equal Access engine — runs if ace.js was injected; returns status flag when not available
  const collectIbmFindings = async () => {
    if (!window.ace || !window.ace.Checker) {
      return { findings: [], available: false };
    }
    try {
      const checker = new window.ace.Checker();
      const report = await checker.check(document, ['IBM_Accessibility']);
      if (!report || !Array.isArray(report.results)) return [];

      const ibmSeverity = (value0) => {
        if (value0 === 'VIOLATION') return 'alto';
        if (value0 === 'POTENTIAL') return 'medio';
        return 'bajo';
      };

      const ibmStatus = (value0, value1) => {
        if (value0 === 'VIOLATION' && value1 === 'FAIL') return 'confirmed';
        return 'needs_review';
      };

      const findings = [];
      for (const result of report.results) {
        const v0 = result.value && result.value[0];
        const v1 = result.value && result.value[1];
        // Skip passes and information-only
        if (v1 === 'PASS' || v1 === 'NA' || v0 === 'PASS' || v0 === 'INFORMATION') continue;
        // Skip recommendations — too noisy for our violation-focused model
        if (v0 === 'RECOMMENDATION') continue;

        const rawMsg = (result.message || result.reasonId || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
        const normKey = normalizeRuleId(result.ruleId || 'ibm-unknown', rawMsg);
        const details = getRuleDetails(result.ruleId || '', rawMsg);
        const nameEs = (details && details.nameEs) ? details.nameEs : rawMsg || (result.ruleId || 'Hallazgo de IBM Equal Access');
        const status = ibmStatus(v0, v1);
        const selector = (result.path && (result.path.dom || result.path.aria)) || 'document';
        const snippet = (result.snippet || '').slice(0, MAX_HTML_SAMPLE);

        findings.push({
          tool: 'ibm-equal-access-extension',
          ruleId: result.ruleId || 'ibm-unknown',
          normalizedRuleId: normKey,
          category: status === 'confirmed' ? 'violation' : 'alert',
          sourceCategory: status === 'confirmed' ? 'violation' : 'alert',
          criterion: (details && details.criterion) || 'Otros',
          wcagCriterion: (details && details.criterion) || 'Otros',
          level: (details && details.level) || 'A',
          wcagLevel: (details && details.level) || 'A',
          nameEs,
          disability: [],
          role: (details && details.role) || 'Desarrollador',
          severity: ibmSeverity(v0),
          findingStatus: status,
          status,
          statusLabel: status === 'confirmed' ? 'Confirmado' : 'Requiere revisión',
          pageState: PAGE_STATE,
          pageStateLabel: PAGE_STATE_LABEL,
          description: rawMsg || (result.ruleId || 'Hallazgo de IBM Equal Access'),
          elementHtml: snippet,
          selector,
          screenshotUrl: '',
          suggestedFix: suggestedFixForRule(result.ruleId || 'ibm-unknown', rawMsg),
          resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2',
          wcagUrl: '',
          affectedElements: [selector],
          affectedHtmlSamples: snippet ? [snippet] : [],
          visualRect: null,
        });
      }

      return { findings: findings.slice(0, 400), available: true };
    } catch (err) {
      console.warn('Sin Barreras: IBM Equal Access no pudo completar el analisis.', err && err.message);
      return { findings: [], available: true, error: String(err && err.message || err) };
    }
  };

  const dedupeFindings = (findings) => {
    const byKey = new Map();
    findings.forEach((finding) => {
      const key = `${finding.normalizedRuleId || finding.ruleId}::${finding.selector || 'document'}::${finding.wcagCriterion || finding.criterion}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, finding);
        return;
      }
      const existingConfirmed = existing.findingStatus === 'confirmed' ? 1 : 0;
      const currentConfirmed = finding.findingStatus === 'confirmed' ? 1 : 0;
      const existingRank = severityRank[existing.severity] || 0;
      const currentRank = severityRank[finding.severity] || 0;
      if (currentConfirmed > existingConfirmed || (currentConfirmed === existingConfirmed && currentRank > existingRank)) {
        byKey.set(key, finding);
      }
    });
    return Array.from(byKey.values());
  };

  // Tab-walk real: simula pulsaciones de Tab reales y lee document.activeElement
  // en cada paso — igual que el worker usa page.keyboard.press('Tab') de Playwright.
  // Detecta: orden de tabulacion roto por tabindex positivos, focus traps, elementos
  // ocultos que reciben foco, y ausencia de indicador visual de foco.
  // Limitacion inherente del browser: dispatchEvent no es OS-level como Playwright,
  // pero es significativamente mas fiel que un inventario DOM puro.
  const collectFocusTraversal = async () => {
    const MAX_FOCUS_STEPS = 120;
    const steps = [];
    const seen = new Set();

    // Guardar estado previo para restaurar al terminar
    const previousActiveElement = document.activeElement;
    window.scrollTo(0, 0);
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    document.body.focus();

    const simulateTab = () => {
      const target = document.activeElement || document.body;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true, cancelable: true }));
      target.dispatchEvent(new KeyboardEvent('keyup',  { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true, cancelable: true }));
    };

    for (let i = 1; i <= MAX_FOCUS_STEPS; i++) {
      simulateTab();
      // Pequena pausa para que frameworks React/Vue procesen el evento de foco
      await new Promise((r) => setTimeout(r, 60));

      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) continue;

      const style = window.getComputedStyle(active);
      const rect = active.getBoundingClientRect();

      // Detectar si el elemento es realmente visible
      const isHidden =
        rect.width <= 0 ||
        rect.height <= 0 ||
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        active.getAttribute('aria-hidden') === 'true';

      // Detectar indicador visual de foco (outline o box-shadow)
      const outlineWidth = parseFloat(style.outlineWidth || '0');
      const hasOutline = outlineWidth >= 2 && style.outlineStyle !== 'none' && style.outlineColor !== 'transparent';
      const hasBoxShadow = style.boxShadow && style.boxShadow !== 'none';
      const hasVisibleFocus = hasOutline || hasBoxShadow;

      const sel = selectorFor(active);
      const posKey = `${sel}-${Math.round(rect.x)}-${Math.round(rect.y)}`;

      // Detectar ciclo: el foco volvio al inicio
      if (seen.has(posKey)) break;
      seen.add(posKey);

      let status = 'ok';
      let issue = 'Flujo correcto con foco visible.';
      let suggestedFix = 'Mantener el orden de foco y el indicador visible.';

      if (isHidden) {
        status = 'error';
        issue = 'El foco llega a un elemento oculto o sin area visible.';
        suggestedFix = 'Quitar el elemento oculto del orden de tabulacion con tabindex="-1" o hacerlo visible al recibir foco.';
      } else if (!hasVisibleFocus) {
        status = 'warning';
        issue = 'El elemento recibe foco pero no se detecta un indicador visual claro.';
        suggestedFix = 'Agregar :focus-visible con outline de alto contraste y al menos 2px de grosor. No usar outline:none sin reemplazo.';
      }

      // Detectar saltos visuales bruscos respecto al paso anterior (tabindex positivos mal usados)
      const previous = steps[steps.length - 1];
      if (previous && status === 'ok') {
        const backwardsJump = rect.y + 80 < previous.rect.y;
        const farJump = Math.abs(rect.y - previous.rect.y) > window.innerHeight * 1.35;
        if (backwardsJump || farJump) {
          status = 'error';
          issue = 'El recorrido de Tab presenta un salto visual que puede desorientar al usuario de teclado.';
          suggestedFix = 'Reordenar el DOM o eliminar tabindex positivos para que el foco avance en orden visual y de lectura.';
        }
      }

      steps.push({
        index: i,
        selector: sel,
        elementHtml: active.outerHTML.slice(0, MAX_HTML_SAMPLE),
        text: textOf(active).slice(0, 160),
        tagName: active.tagName.toLowerCase(),
        role: inferRole(active),
        accessibleName: accessibleName(active),
        rect: {
          x: Math.max(0, Math.round(rect.left + window.scrollX)),
          y: Math.max(0, Math.round(rect.top + window.scrollY)),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
        },
        status,
        issue,
        suggestedFix,
      });
    }

    // Restaurar foco al elemento original para no dejar la página en estado extrano
    try {
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      } else {
        document.body.focus();
      }
    } catch (_) {}

    return {
      screenshotUrl: '',
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageSize: {
        width: Math.max(document.documentElement.scrollWidth, window.innerWidth),
        height: Math.max(document.documentElement.scrollHeight, window.innerHeight),
      },
      steps,
      summary: {
        total: steps.length,
        ok: steps.filter((s) => s.status === 'ok').length,
        warning: steps.filter((s) => s.status === 'warning').length,
        error: steps.filter((s) => s.status === 'error').length,
      },
    };
  };

  const collectSemanticStructure = () => {
    const items = [];
    const push = (kind, element, extra = {}) => {
      const name = accessibleName(element);
      const selector = selectorFor(element);
      const warning = ['form', 'iframe', 'landmark'].includes(kind) && !name;
      items.push({
        index: items.length + 1,
        kind,
        label: extra.label || name || element.tagName.toLowerCase(),
        level: extra.level,
        role: inferRole(element),
        selector,
        accessibleName: name,
        text: textOf(element).slice(0, 180),
        status: warning ? 'warning' : 'ok',
        issue: warning ? 'Elemento estructural sin nombre accesible.' : 'Estructura detectada.',
        suggestedFix: warning ? 'Agregar nombre accesible mediante título visible, aria-label o aria-labelledby.' : 'Mantener la estructura semántica.',
      });
    };

    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((element) => {
      push('heading', element, { level: Number(element.tagName.slice(1)), label: element.tagName });
    });
    document.querySelectorAll('main,nav,header,footer,aside,section[aria-label],section[aria-labelledby],[role="main"],[role="navigation"],[role="banner"],[role="contentinfo"],[role="complementary"]').forEach((element) => push('landmark', element));
    document.querySelectorAll('form').forEach((element) => push('form', element));
    document.querySelectorAll('table').forEach((element) => push('table', element));
    document.querySelectorAll('iframe').forEach((element) => push('iframe', element));
    document.querySelectorAll('button,a[href],input,select,textarea').forEach((element) => push('interactive', element));

    return {
      items: items.slice(0, 300),
      summary: {
        headings: items.filter((item) => item.kind === 'heading').length,
        landmarks: items.filter((item) => item.kind === 'landmark').length,
        forms: items.filter((item) => item.kind === 'form').length,
        tables: items.filter((item) => item.kind === 'table').length,
        iframes: items.filter((item) => item.kind === 'iframe').length,
        interactive: items.filter((item) => item.kind === 'interactive').length,
        warnings: items.filter((item) => item.status === 'warning').length,
        errors: items.filter((item) => item.status === 'error').length,
      },
    };
  };

  const collectContentDetection = () => {
    const q = (selector) => Boolean(document.querySelector(selector));
    const all = (selector) => Array.from(document.querySelectorAll(selector));
    const text = document.body?.innerText?.toLowerCase() || '';
    const hasAnimation = all('*').slice(0, 1500).some((element) => {
      const style = window.getComputedStyle(element);
      return Boolean((style.animationName && style.animationName !== 'none') || (style.transitionDuration && style.transitionDuration !== '0s'));
    });
    const hasDragHandler = all('*').slice(0, 2000).some((element) => {
      const attrs = Array.from(element.attributes || []).map((attr) => attr.name.toLowerCase());
      return attrs.some((name) => name.startsWith('ondrag'));
    });
    const hasImageText = all('img').some((img) => {
      const alt = (img.getAttribute('alt') || '').trim();
      return alt.split(/\s+/).length >= 4 || /texto|logo|banner|título|title/i.test(alt);
    });

    return {
      tiene_imagenes: q('img, [role="img"], canvas, input[type="image"]'),
      tiene_svg_funcional: q('svg:not([aria-hidden="true"])'),
      tiene_video: q('video'),
      tiene_audio: q('audio'),
      tiene_audio_autoplay: q('audio[autoplay], video[autoplay]'),
      tiene_formularios: q('input, select, textarea'),
      tiene_inputs_texto: q('input[type="text"], input[type="email"], input[type="password"], input:not([type]), textarea'),
      tiene_select: q('select'),
      tiene_checkboxes_radios: q('input[type="checkbox"], input[type="radio"]'),
      tiene_autenticacion: q('input[type="password"]'),
      tiene_captcha: q('iframe[src*="recaptcha"], iframe[src*="captcha"], .g-recaptcha, [data-sitekey]'),
      tiene_enlaces: q('a[href]'),
      tiene_tablas: q('table'),
      tiene_encabezados: q('h1, h2, h3, h4, h5, h6'),
      tiene_iframes: q('iframe'),
      tiene_drag_and_drop: q('[draggable="true"]') || hasDragHandler,
      tiene_animaciones_css: hasAnimation,
      tiene_movimiento_automatico: q('[data-autoplay], .carousel, .slider, marquee, [aria-roledescription="carousel"]'),
      tiene_contenido_hover: q('[role="tooltip"], .tooltip, .dropdown, [aria-haspopup]'),
      tiene_timeout_sesion: q('meta[http-equiv="refresh"], [data-timeout], [data-timer], .timer, .countdown') || /tiempo de sesi[oó]n|expira|expiraci[oó]n|inactividad/.test(text),
      tiene_mensajes_estado: q('[role="alert"], [role="status"], [aria-live]'),
      tiene_contenido_multipagina: q('nav a[href], [aria-label*="breadcrumb" i], .breadcrumb, a[href*="sitemap"], a[href*="mapa-del-sitio"]'),
      tiene_proceso_multipaso: q('[data-step], .wizard, .step, .stepper') || /paso\s+\d|siguiente|anterior/.test(text),
      tiene_transacciones: /pago|compra|checkout|carrito|tarjeta|transferencia|firma|declaraci[oó]n jurada|datos personales|dni/.test(text),
      tiene_imagenes_de_texto: hasImageText,
      tiene_ayuda: q('a[href*="ayuda"], a[href*="help"], a[href*="contacto"], [aria-label*="ayuda" i], [aria-label*="help" i]'),
      es_dominio_gob_pe: window.location.hostname.endsWith('.gob.pe'),
    };
  };

  const countApplicableCriteria = (d) => {
    let inapplicable = 0;
    if (!d.tiene_video && !d.tiene_audio) inapplicable += 9;
    if (!d.tiene_audio) inapplicable += 1;
    if (!d.tiene_formularios) inapplicable += 7;
    if (!d.tiene_audio_autoplay) inapplicable += 1;
    if (!d.tiene_imagenes_de_texto) inapplicable += 2;
    if (!d.tiene_contenido_hover) inapplicable += 1;
    inapplicable += 1;
    if (!d.tiene_timeout_sesion) inapplicable += 3;
    if (!d.tiene_movimiento_automatico) inapplicable += 1;
    if (!d.tiene_mensajes_estado) inapplicable += 2;
    if (!d.tiene_autenticacion) inapplicable += 1;
    if (!d.tiene_animaciones_css) inapplicable += 3;
    if (!d.tiene_drag_and_drop) inapplicable += 2;
    if (!d.tiene_contenido_multipagina) inapplicable += 4;
    inapplicable += 6;
    if (!d.tiene_ayuda) inapplicable += 1;
    if (!d.tiene_transacciones) inapplicable += 1;
    if (!d.tiene_proceso_multipaso) inapplicable += 1;
    if (!d.tiene_autenticacion && !d.tiene_captcha) inapplicable += 2;
    return Math.max(10, 86 - inapplicable);
  };

  const scoreFromFindings = (violations, reviews, contentDetection) => {
    const applicableCount = contentDetection ? countApplicableCriteria(contentDetection) : 86;
    const failedCriteria = new Set(violations.map((f) => f.wcagCriterion || f.criterion).filter(Boolean));
    const reviewCriteria = new Set(
      reviews.map((r) => r.wcagCriterion || r.criterion).filter((id) => id && !failedCriteria.has(id))
    );
    const failedCount = Math.min(failedCriteria.size, applicableCount);
    const reviewCount = Math.min(reviewCriteria.size, Math.max(0, applicableCount - failedCount));
    const passedCount = Math.max(0, applicableCount - failedCount - reviewCount);
    return Math.max(0, Math.min(100, Math.round((passedCount / applicableCount) * 100)));
  };

  // Peruvian compliance checks — port of worker/src/peruvianChecks.ts (pure DOM, no Playwright)
  const collectPeruvianChecks = () => {
    const results = [];
    const url = window.location.href;
    const isGobPe = window.location.hostname.endsWith('.gob.pe');
    const bodyText = (document.body && document.body.innerHTML || '').toLowerCase();

    // Check 1: Sign Language in Videos (Art. 7.4 / Criterion 1.2.6)
    const videoEls = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
    if (videoEls.length > 0) {
      const signIndicators = ['lengua de señas', 'lengua de senas', 'sign language', 'intérprete', 'interprete', 'lsp', 'señas peruana', 'senas peruana'];
      const hasSignText = signIndicators.some((ind) => bodyText.includes(ind));
      const signEls = document.querySelectorAll('[class*="sign-language"], [class*="lengua-senas"], [class*="senas"], [aria-label*="señas"], [aria-label*="sign"]');
      if (hasSignText || signEls.length > 0) {
        results.push({ id: 'peru-sign-language', criterion: '1.2.6', name: 'Lengua de Señas Peruana en multimedia', status: 'manual_review', description: 'Se detectaron indicadores de Lengua de Señas Peruana. Verificar que el intérprete esté presente en los videos.', details: `${videoEls.length} elemento(s) multimedia y ${signEls.length} indicador(es) de señas.` });
      } else {
        results.push({ id: 'peru-sign-language', criterion: '1.2.6', name: 'Lengua de Señas Peruana en multimedia', status: isGobPe ? 'fail' : 'warning', description: `Se encontraron ${videoEls.length} elemento(s) multimedia sin indicadores de interpretación en LSP (Ley N° 29535).`, details: 'Art. 7.4 de la Resolución N° 001-2025-PCM/SGTD exige interpretación en LSP para sitios de la Administración Pública.' });
      }
    }

    // Check 2: Native Languages (Art. 7.4) — only for .gob.pe
    if (isGobPe) {
      const nativeLangs = ['quechua', 'aimara', 'aymara', 'asháninka', 'ashaninka', 'shipibo', 'awajún', 'awajun'];
      const hasNativeLang = nativeLangs.some((lang) => bodyText.includes(lang));
      const langSwitcher = document.querySelectorAll('[class*="lang-switch"], [class*="idioma"], [id*="language"], select[name*="lang"]');
      results.push({ id: 'peru-native-languages', criterion: '7.4', name: 'Integración de lenguas originarias', status: hasNativeLang || langSwitcher.length > 0 ? 'manual_review' : 'warning', description: hasNativeLang || langSwitcher.length > 0 ? 'Se detectaron posibles referencias a lenguas originarias. Verificar disponibilidad de contenido completo.' : 'No se detectó soporte para lenguas originarias (quechua, aimara, etc.). Obligatorio para gobiernos regionales y locales.' });
    }

    // Check 3: Support Materials (Art. 7.5) — only for .gob.pe
    if (isGobPe) {
      const hasInstructives = bodyText.includes('instructivo') || bodyText.includes('guía') || bodyText.includes('guia') || bodyText.includes('manual de uso');
      const hasTutorials = bodyText.includes('tutorial') || bodyText.includes('video tutorial');
      const hasAssistant = bodyText.includes('asistente virtual') || bodyText.includes('chatbot') || Boolean(document.querySelector('[class*="chatbot"], [class*="chat-widget"], [id*="chatbot"]'));
      const hasChat = bodyText.includes('chat en línea') || bodyText.includes('chat en linea') || Boolean(document.querySelector('[class*="live-chat"], [class*="chat-online"]'));
      const hasPictograms = bodyText.includes('pictograma') || Boolean(document.querySelector('[class*="pictogram"]'));
      const anyFound = hasInstructives || hasTutorials || hasAssistant || hasChat || hasPictograms;
      results.push({ id: 'peru-support-materials', criterion: '7.5', name: 'Materiales de apoyo accesibles', status: anyFound ? 'manual_review' : 'fail', description: 'Verificación de materiales de apoyo según Art. 7.5 de la Resolución.', details: [`Instructivos: ${hasInstructives ? '✓' : '✗'}`, `Tutoriales: ${hasTutorials ? '✓' : '✗'}`, `Asistente virtual: ${hasAssistant ? '✓' : '✗'}`, `Chat en línea: ${hasChat ? '✓' : '✗'}`, `Pictogramas: ${hasPictograms ? '✓' : '✗'}`].join(' | ') });
    }

    // Check 4: Accessibility Declaration (Art. VIII) — only for .gob.pe
    if (isGobPe) {
      const hasDeclaration = bodyText.includes('declaración de accesibilidad') || bodyText.includes('declaracion de accesibilidad') || bodyText.includes('accesibilidad digital') || Boolean(document.querySelector('a[href*="accesibilidad"]'));
      results.push({ id: 'peru-accessibility-declaration', criterion: 'Art. VIII', name: 'Declaración de Accesibilidad Digital publicada', status: hasDeclaration ? 'manual_review' : 'fail', description: hasDeclaration ? 'Se encontró una posible declaración de accesibilidad. Verificar que cumple el formato requerido.' : 'No se encontró Declaración de Accesibilidad Digital. Obligatorio para entidades de la Administración Pública (Art. VIII).' });
    }

    // Check 5: Contact Channel (Art. 7.5) — only for .gob.pe
    if (isGobPe) {
      const hasContact = bodyText.includes('mesadeayuda@gobiernodigital.gob.pe') || bodyText.includes('mesa de ayuda') || bodyText.includes('reportar problema de accesibilidad') || bodyText.includes('canal de contacto') || Boolean(document.querySelector('a[href*="mesadeayuda"], a[href*="contacto"]'));
      results.push({ id: 'peru-contact-channel', criterion: '7.5', name: 'Canal de contacto para problemas de accesibilidad', status: hasContact ? 'pass' : 'fail', description: hasContact ? 'Se detectó un canal de contacto para reportar problemas de accesibilidad.' : 'No se encontró canal de contacto. Referencia: mesadeayuda@gobiernodigital.gob.pe.' });
    }

    return results;
  };

  // Interactive state exploration — clicks triggers to reveal hidden states and re-scans with axe
  // Mirrors worker runInteractiveStateAccessibilityEngines but without Playwright keyboard API.
  // Solo se clickean disclosures (menús, acordeones, dropdowns) — nunca botones
  // genéricos: en apps autenticadas un click puede enviar formularios, navegar
  // (matando este contexto y toda la auditoría) o disparar acciones destructivas.
  const isSafeTrigger = (el) => {
    if (el.closest('a[href]')) return false; // los enlaces navegan
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (type === 'submit' || type === 'reset') return false;
    // <button> sin type dentro de <form> es submit implícito.
    if (el.tagName === 'BUTTON' && !type && el.closest('form')) return false;
    const text = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`.toLowerCase();
    if (/cerrar sesi|logout|log out|salir|sign out|eliminar|borrar|delete|remove|quitar|guardar|save|enviar|submit|confirmar|pagar|comprar|checkout|descargar|download|imprimir|print|recargar|reload|actualizar/.test(text)) return false;
    return true;
  };

  const collectInteractiveStateFindings = async () => {
    const findings = [];
    const TRIGGER_SELECTOR = [
      '[aria-haspopup]:not([disabled])',
      '[aria-expanded="false"]:not([disabled])',
      'summary',
      'a[data-toggle]',
      'button[data-toggle]:not([disabled])',
      'button[data-bs-toggle]:not([disabled])',
    ].join(',');

    const triggers = Array.from(document.querySelectorAll(TRIGGER_SELECTOR))
      .filter((el) => isVisible(el) && isSafeTrigger(el))
      .slice(0, 15);

    if (!window.axe || triggers.length === 0) return findings;

    const snapshotHtml = document.documentElement.innerHTML;

    // En DOMs grandes cada axe.run puede tardar varios segundos; sin tope la
    // fase interactiva se alarga minutos y el popup parece colgado.
    const INTERACTIVE_BUDGET_MS = 25_000;
    const startedAt = Date.now();

    for (const trigger of triggers) {
      if (Date.now() - startedAt > INTERACTIVE_BUDGET_MS) break;
      const label = (trigger.getAttribute('aria-label') || trigger.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      try {
        trigger.click();
        await new Promise((r) => setTimeout(r, 400));

        const axeAfter = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22a', 'wcag22aa'] },
          resultTypes: ['violations'],
        });

        const newFindings = axeAfter.violations.flatMap((rule) =>
          rule.nodes.map((node) => {
            const f = buildFinding(rule, node, 'violation');
            f.pageState = 'interactive_trigger';
            f.pageStateLabel = `Estado tras clic en: "${label || trigger.tagName.toLowerCase()}"`;
            f.tool = 'axe-extension-interactive';
            return f;
          })
        );
        findings.push(...newFindings);

        // Attempt to restore: click again to close (toggles), or press Escape
        try {
          trigger.click();
        } catch {
          // ignore
        }
        try {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 200));
      } catch {
        // Trigger click failed — skip
      }
    }

    // Dedupe against base findings by ruleId+selector
    return findings;
  };

  window.__sinBarrerasAuditCurrentPage = async () => {
    if (!window.axe) {
      throw new Error('axe-core no esta disponible en la pestaña.');
    }

    // Locale español (inyectado por popup.js como axe-locale-es.js). Si falla,
    // axe corre con mensajes en inglés — nunca bloquea la auditoría.
    try {
      if (window.__SB_AXE_LOCALE_ES) window.axe.configure({ locale: window.__SB_AXE_LOCALE_ES });
    } catch (_) { /* fallback inglés */ }

    const axeResult = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag22a', 'wcag22aa', 'wcag22aaa', 'best-practice'],
      },
      resultTypes: ['violations', 'incomplete', 'passes'],
    });

    const axeViolations = axeResult.violations.flatMap((rule) =>
      rule.nodes.map((node) => buildFinding(rule, node, 'violation'))
    );
    const axeManualVerifications = axeResult.incomplete.flatMap((rule) =>
      rule.nodes.map((node) => buildFinding(rule, node, 'alert'))
    );
    const heuristicFindings = collectHeuristicDomFindings();
    const ibmResult = await collectIbmFindings();
    // Tab-walk ANTES de los triggers interactivos: los triggers hacen click() en el DOM
    // y pueden dejar modales abiertos o cambiar el estado de foco de la página.
    // El Tab-walk necesita el DOM en estado inicial limpio para ser preciso.
    const focusTraversalResult = await collectFocusTraversal();
    // La fase interactiva es la más frágil (clicks reales sobre la página);
    // si falla, la auditoría base igual debe llegar al sistema.
    let interactiveFindings = [];
    try {
      interactiveFindings = await collectInteractiveStateFindings();
    } catch (_) { /* degradar sin perder la auditoría base */ }
    const allFindings = dedupeFindings([...axeViolations, ...axeManualVerifications, ...heuristicFindings, ...ibmResult.findings, ...interactiveFindings]);
    const violations = allFindings.filter((finding) => finding.findingStatus === 'confirmed');
    const manualVerifications = allFindings.filter((finding) => finding.findingStatus !== 'confirmed');
    const peruvianChecks = collectPeruvianChecks();

    const contentDetection = collectContentDetection();
    const score = scoreFromFindings(violations, manualVerifications, contentDetection);
    const visualMarkers = [...violations, ...manualVerifications]
      .filter((finding) => finding.visualRect && finding.visualRect.width > 0 && finding.visualRect.height > 0)
      .slice(0, 200)
      .map((finding, index) => ({
        id: `${finding.ruleId}-${index + 1}`,
        ruleId: finding.ruleId,
        normalizedRuleId: finding.normalizedRuleId,
        criterion: finding.wcagCriterion,
        selector: finding.selector,
        description: finding.description,
        severity: finding.severity,
        status: finding.status,
        statusLabel: finding.statusLabel,
        pageState: PAGE_STATE,
        x: finding.visualRect.x,
        y: finding.visualRect.y,
        width: finding.visualRect.width,
        height: finding.visualRect.height,
      }));

    return {
      source: 'browser-extension',
      url: window.location.href,
      title: document.title,
      score,
      violations,
      manualVerifications,
      peruvianChecks,
      contentDetection,
      applicability: {
        summary: {
          totalCriteria: 86,
          applicableCount: countApplicableCriteria(contentDetection),
          notApplicableCount: 86 - countApplicableCriteria(contentDetection),
          failedCount: new Set(violations.map((item) => item.wcagCriterion || item.criterion).filter(Boolean)).size,
          reviewCount: new Set(manualVerifications.map((item) => item.wcagCriterion || item.criterion).filter(Boolean)).size,
          passedCount: Math.max(0, countApplicableCriteria(contentDetection) - new Set(violations.map((item) => item.wcagCriterion || item.criterion).filter(Boolean)).size),
          score,
        },
      },
      engineReport: [
        {
          engine: 'axe-extension',
          pageState: PAGE_STATE,
          status: 'ok',
          durationMs: 0,
          findingsCount: axeViolations.length + axeManualVerifications.length,
        },
        {
          engine: 'heuristic-dom-extension',
          pageState: PAGE_STATE,
          status: 'ok',
          durationMs: 0,
          findingsCount: heuristicFindings.length,
        },
        {
          engine: 'ibm-equal-access-extension',
          pageState: PAGE_STATE,
          status: ibmResult.available ? (ibmResult.error ? 'failed' : 'ok') : 'not_available',
          durationMs: 0,
          findingsCount: ibmResult.findings.length,
          ...(ibmResult.available ? {} : { reason: 'ace.js no fue inyectado en esta pestaña' }),
          ...(ibmResult.error ? { errorMessage: ibmResult.error } : {}),
        },
        {
          engine: 'axe-extension-interactive',
          pageState: 'interactive_trigger',
          status: 'ok',
          durationMs: 0,
          findingsCount: interactiveFindings.length,
        },
        {
          engine: 'peruvian-checks-extension',
          pageState: PAGE_STATE,
          status: 'ok',
          durationMs: 0,
          findingsCount: peruvianChecks.length,
        },
      ],
      focusTraversal: focusTraversalResult,
      semanticStructure: collectSemanticStructure(),
      visualMap: {
        states: [
          {
            pageState: PAGE_STATE,
            pageStateLabel: PAGE_STATE_LABEL,
            screenshotUrl: '',
            viewport: { width: window.innerWidth, height: window.innerHeight },
            pageSize: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            markers: visualMarkers,
          },
        ],
      },
    };
  };
})();
