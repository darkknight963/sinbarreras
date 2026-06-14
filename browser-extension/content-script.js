(function () {
  const PAGE_STATE = 'interactive_state';
  const PAGE_STATE_LABEL = 'Pestana autenticada';
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

  const statusForCategory = (category) => category === 'violation' ? 'confirmed' : 'needs_review';

  // Full Spanish names + fixes — mirrors worker wcagRules.ts ruleMapping + extraRuleMapping
  const RULE_DETAILS = {
    'image-alt':                          { nameEs: 'Contenido no textual',                             criterion: '1.1.1',          level: 'A',   role: 'Compartido',     suggestedFix: 'Si la imagen transmite informacion, agregar alt descriptivo y breve (maximo 150 caracteres). Si es decorativa, usar alt="" y no agregar aria-hidden salvo en svgs decorativos.' },
    'input-image-alt':                    { nameEs: 'Contenido no textual',                             criterion: '1.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar alt al input[type=image] con el texto que describe la accion del boton (no la imagen), por ejemplo alt="Buscar".' },
    'image-ignored-review':               { nameEs: 'Contenido no textual - imagen ignorada',           criterion: '1.1.1',          level: 'A',   role: 'Compartido',     suggestedFix: 'Confirmar si la imagen es decorativa. Si transmite informacion, quitar aria-hidden y agregar texto alternativo descriptivo.' },
    'color-contrast':                     { nameEs: 'Contraste minimo',                                 criterion: '1.4.3',          level: 'AA',  role: 'Diseñador UX/UI', suggestedFix: 'Ajustar los colores de texto y fondo para alcanzar una relacion de contraste de al menos 4.5:1 en texto normal o 3:1 en texto grande. Usar herramientas como WebAIM Contrast Checker para verificar.' },
    'color-contrast-enhanced':            { nameEs: 'Contraste mejorado',                               criterion: '1.4.6',          level: 'AAA', role: 'Diseñador UX/UI', suggestedFix: 'Para nivel AAA ajustar contraste a minimo 7:1 en texto normal y 4.5:1 en texto grande. Especialmente critico para usuarios con baja vision severa.' },
    'contrast-image-background-undetermined': { nameEs: 'Contraste sobre fondo imagen (revision)',      criterion: '1.4.3',          level: 'AA',  role: 'Diseñador UX/UI', suggestedFix: 'Revisar el contraste sobre la captura real. Si no alcanza 4.5:1 en texto normal, agregar capa solida/semitransparente o cambiar texto/fondo; no depender solo de sombra.' },
    'reflow-fixed-position':              { nameEs: 'Reflow - posicion fija',                           criterion: '1.4.10',         level: 'AA',  role: 'Desarrollador',  suggestedFix: 'Verificar que el elemento fijo no obligue a desplazamiento en dos dimensiones y sea usable a 320 CSS px de ancho.' },
    'region':                             { nameEs: 'Informacion y relaciones - regiones',              criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Ubicar el contenido relevante dentro de landmarks semanticos como main, nav, header, footer o regiones con nombre accesible.' },
    'empty-list-item':                    { nameEs: 'Elemento de lista vacio',                          criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Eliminar el <li> vacio. Si se usa solo para separacion o decoracion, mover ese efecto a CSS; las listas deben contener elementos con significado.' },
    'heading-markup-review':              { nameEs: 'Informacion y relaciones - encabezado visual',     criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Si el texto funciona como encabezado, usar el elemento h1-h6 correspondiente y mantener una jerarquia logica.' },
    'table-purpose-review':               { nameEs: 'Proposito de tabla no claro',                      criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Determinar si la tabla es de datos o maquetacion. Si es de datos, agregar caption, th y scope; si es maquetacion, reemplazar por CSS o usar role="presentation".' },
    'table-caption-review':               { nameEs: 'Informacion y relaciones - caption de tabla',      criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Si es una tabla de datos, agregar un caption que identifique claramente el proposito de la tabla.' },
    'select-optgroup':                    { nameEs: 'Informacion y relaciones - grupos de opciones',    criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Si la lista contiene grupos de opciones relacionadas, agruparlas con optgroup y etiquetas descriptivas.' },
    'label-not-form-control':             { nameEs: 'Informacion y relaciones - label mal asociado',    criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Corregir el atributo for para que apunte al id de un control de formulario real o asociar el texto mediante aria-describedby si es ayuda.' },
    'form-field-label-missing':           { nameEs: 'Informacion y relaciones - campo sin etiqueta',    criterion: '1.3.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Etiquetar el campo con label asociado, title, aria-label o aria-labelledby segun corresponda.' },
    'content-behind-dialog-accessible':   { nameEs: 'Contenido detras del dialogo accesible',           criterion: '1.3.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Cuando el dialogo este abierto, ocultar o inhabilitar programaticamente el contenido de fondo con inert/aria-hidden y gestionar el foco dentro del modal.' },
    'autocomplete-missing':               { nameEs: 'Identificar proposito de entrada',                 criterion: '1.3.5',          level: 'AA',  role: 'Desarrollador',  suggestedFix: 'Agregar un token autocomplete especifico segun el dato solicitado, por ejemplo name, given-name, family-name, email, tel, address-line1 o one-time-code.' },
    'bypass':                             { nameEs: 'Evitar bloques',                                   criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar antes del primer elemento interactivo un enlace "Saltar al contenido" visible al foco que apunte a id="main-content". Confirmar que el destino existe y recibe foco.' },
    'bypass-missing':                     { nameEs: 'Metodo para saltar bloques',                       criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar antes del encabezado un enlace "Saltar al contenido principal" que apunte a #main-content, sea visible al recibir foco y funcione con teclado.' },
    'landmark-main-missing':              { nameEs: 'Evitar bloques (main landmark)',                   criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Envolver el contenido principal con un unico <main id="main-content"> o role="main"; no incluir header, nav ni footer repetitivos dentro del main.' },
    'landmark-nav-missing':               { nameEs: 'Evitar bloques (nav landmark)',                    criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Marcar la navegacion principal con <nav aria-label="Navegacion principal"> o role="navigation" con nombre accesible cuando haya mas de una navegacion.' },
    'iframe-title':                       { nameEs: 'Evitar bloques - titulo de iframe',                criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar un atributo title no vacio al iframe que describa su contenido o proposito.' },
    'h1-in-header':                       { nameEs: 'H1 dentro del encabezado',                        criterion: '2.4.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Usar el h1 para el titulo unico del contenido principal y dejar la marca del header como texto normal, p o span.' },
    'document-title':                     { nameEs: 'Titulado de paginas',                              criterion: '2.4.2',          level: 'A',   role: 'Redactor UX',    suggestedFix: 'Definir un title unico y descriptivo con formato "Nombre pagina | Sistema" (maximo 60-70 caracteres). Actualizar en cada vista de SPA.' },
    'link-name':                          { nameEs: 'Proposito de los enlaces',                         criterion: '2.4.4',          level: 'A',   role: 'Redactor UX',    suggestedFix: 'Agregar texto visible descriptivo al enlace. Si solo tiene icono, usar aria-label con el proposito real. Evitar textos genericos como "click aqui" o "leer mas".' },
    'link-name-missing':                  { nameEs: 'Enlace sin texto o nombre accesible',              criterion: '2.4.4',          level: 'A',   role: 'Redactor UX',    suggestedFix: 'Agregar texto de enlace visible y especifico que indique destino o accion. Si es solo icono, usar aria-label que incluya el proposito visible.' },
    'focus-visible':                      { nameEs: 'Foco visible',                                     criterion: '2.4.7',          level: 'AA',  role: 'Compartido',     suggestedFix: 'Definir :focus-visible con outline minimo de 2px de contraste 3:1, sin eliminar el outline del navegador sin reemplazo. Evitar outline:none sin definir estilo alternativo.' },
    'link-href-missing':                  { nameEs: 'Enlace sin href',                                  criterion: '2.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Si el elemento navega, usar <a href="..."> con destino valido. Si ejecuta una accion sin navegar, reemplazarlo por <button type="button"> accesible por teclado.' },
    'scrollable-region-focusable':        { nameEs: 'Teclado - region desplazable',                     criterion: '2.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Hacer enfocable el contenedor desplazable con tabindex="0", agregar nombre accesible si corresponde y comprobar que se pueda desplazar solo con teclado.' },
    'target-size':                        { nameEs: 'Tamano del area de interaccion minimo',            criterion: '2.5.8',          level: 'AA',  role: 'Diseñador UX/UI', suggestedFix: 'Asegurar que areas de interaccion tengan minimo 24x24 CSS px (WCAG 2.2 AA) o preferiblemente 44x44 CSS px para mejor usabilidad movil.' },
    'label':                              { nameEs: 'Etiquetas o instrucciones',                        criterion: '3.3.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Asociar cada control con label[for="id"] visible. Priorizar texto visible sobre aria-label. Usar aria-describedby para instrucciones adicionales, no como etiqueta principal.' },
    'form-control-multiple-labels':       { nameEs: 'Etiquetas multiples por control',                  criterion: '3.3.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Dejar un solo label programatico asociado al campo. Mover instrucciones, ejemplos y mensajes de error a elementos referenciados con aria-describedby.' },
    'label-empty-text':                   { nameEs: 'Etiqueta vacia',                                   criterion: '3.3.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar texto descriptivo al label asociado o eliminarlo si no corresponde; un label vacio no debe ser la unica etiqueta del control.' },
    'required-html5-indicator':           { nameEs: 'Indicacion de campos requeridos',                  criterion: '3.3.2',          level: 'A',   role: 'Compartido',     suggestedFix: 'Mantener required si aplica, pero agregar una indicacion visible antes del envio, por ejemplo texto "Obligatorio", y asegurar que el error sea anunciado.' },
    'title-non-interactive':              { nameEs: 'Title en elemento no interactivo',                 criterion: '3.3.2',          level: 'A',   role: 'Compartido',     suggestedFix: 'No depender de title para informacion importante. Mostrar el texto de forma visible o asociarlo con aria-describedby a un control relacionado.' },
    'html-has-lang':                      { nameEs: 'Idioma de la pagina',                              criterion: '3.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar lang="es" o el BCP 47 correspondiente en el elemento html. Para contenido peruano usar lang="es-PE".' },
    'html-lang-valid':                    { nameEs: 'Idioma de la pagina (Valido)',                     criterion: '3.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Verificar que el codigo de idioma sea un BCP 47 valido, por ejemplo es, es-PE, en, en-US.' },
    'html-lang-missing':                  { nameEs: 'Idioma de la pagina',                              criterion: '3.1.1',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar en el elemento html un atributo lang valido segun el idioma principal, por ejemplo lang="es". Si hay fragmentos en otro idioma, marcarlos con lang propio.' },
    'valid-lang':                         { nameEs: 'Idioma de las partes de la pagina',                criterion: '3.1.2',          level: 'AA',  role: 'Compartido',     suggestedFix: 'Usar codigos de idioma BCP 47 validos en todos los atributos lang de la pagina.' },
    'button-name':                        { nameEs: 'Nombre, funcion y valor',                          criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar nombre accesible al boton: texto visible preferente, aria-label para botones icono o aria-labelledby apuntando a texto existente.' },
    'button-name-missing':                { nameEs: 'Boton sin nombre accesible',                       criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar nombre accesible al boton. Preferir texto visible; en botones solo icono usar aria-label que describa la accion, por ejemplo "Cerrar modal".' },
    'input-name-missing':                 { nameEs: 'Campo sin nombre accesible',                       criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Asociar cada control con un <label for="id"> visible. Usar aria-labelledby si ya existe texto visible; usar aria-describedby solo para ayudas o errores.' },
    'aria-allowed-attr':                  { nameEs: 'Nombre, funcion y valor',                          criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Eliminar atributos ARIA no permitidos para el rol del elemento. Consultar la especificacion ARIA para ver que atributos acepta cada rol y preferir HTML nativo.' },
    'aria-roles':                         { nameEs: 'Nombre, funcion y valor',                          criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Usar solo roles ARIA validos de la especificacion WAI-ARIA 1.2. Preferir elementos HTML nativos con semantica equivalente cuando existan.' },
    'duplicate-id':                       { nameEs: 'Nombre, funcion y valor - ids unicos',             criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Asignar ids unicos en toda la pagina incluyendo componentes reutilizables. Actualizar todos los for, aria-labelledby, aria-controls que referencian el id duplicado.' },
    'aria-required-owned-element':        { nameEs: 'Widget ARIA sin elemento hijo requerido',          criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Corregir el patron ARIA: el contenedor debe tener los roles hijos obligatorios (por ejemplo listbox > option). Si no es un widget real, quitar el role ARIA y usar HTML nativo.' },
    'aria-widget-name-missing':           { nameEs: 'Widget ARIA sin nombre accesible',                 criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar nombre accesible al widget con aria-labelledby apuntando a un titulo visible. Usar aria-label solo si no existe texto visible adecuado.' },
    'aria-dialog-name':                   { nameEs: 'Nombre, funcion y valor - dialogo sin nombre',     criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar un nombre accesible al dialogo usando aria-labelledby con un titulo visible existente o aria-label descriptivo.' },
    'aria-valid-attr-value':              { nameEs: 'Valores ARIA validos',                             criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Corregir atributos ARIA para que tengan valores validos y referencias existentes, especialmente aria-labelledby.' },
    'select-value':                       { nameEs: 'Nombre, funcion y valor - select sin valor',       criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Verificar que el select exponga nombre y valor actual a la API de accesibilidad mediante label, option seleccionado y estado valido.' },
    'textarea-name':                      { nameEs: 'Nombre, funcion y valor - textarea sin nombre',    criterion: '4.1.2',          level: 'A',   role: 'Desarrollador',  suggestedFix: 'Agregar un nombre accesible al textarea con label, title, aria-label o aria-labelledby valido.' },
    'frame-tested':                       { nameEs: 'Contenido embebido no evaluado',                   criterion: 'Revision manual', level: 'A',  role: 'Compartido',     suggestedFix: 'Escanear directamente la URL del iframe o revisar manualmente su contenido para confirmar incumplimientos WCAG aplicables.' },
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
    if (k.includes('image-alt')) return 'Si la imagen transmite informacion, agregar alt descriptivo y breve. Si es decorativa, dejar alt="" y evitar aria-hidden en imagenes informativas.';
    if (k.includes('aria')) return 'Corregir nombre, rol, valor y referencias ARIA. Preferir HTML nativo cuando sea posible y validar con lector de pantalla o arbol de accesibilidad.';
    const fallback = String(description || '');
    return fallback.length > 30
      ? 'Revisar el elemento concreto y aplicar la correccion indicada por el criterio WCAG asociado.'
      : 'Corregir el elemento segun el criterio WCAG indicado y validar nuevamente con teclado, lector de pantalla o contraste segun corresponda.';
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
    const status = statusForCategory(category);
    const normKey = normalizeRuleId(rule.id, rule.description || rule.help);
    const details = getRuleDetails(rule.id, rule.description || rule.help);
    const rawDesc = (rule.description || rule.help || '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
    const nameEs = (details && details.nameEs) ? details.nameEs : (rule.help || rule.id);
    const ruleCriterion = (details && details.criterion) || criterion;
    const ruleLevel = (details && details.level) || level;
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
      statusLabel: status === 'confirmed' ? 'Confirmado' : 'Requiere revision',
      pageState: PAGE_STATE,
      pageStateLabel: PAGE_STATE_LABEL,
      description: rawDesc || rule.id,
      elementHtml: (node.html || '').slice(0, MAX_HTML_SAMPLE),
      selector: target || 'document',
      screenshotUrl: '',
      suggestedFix: suggestedFixForRule(rule.id, rule.description || rule.help || ''),
      resolutionArticle: ruleCriterion && ruleCriterion !== 'N/A' && ruleCriterion !== 'Revision manual' ? `Anexo 1 - Criterio ${ruleCriterion}` : 'ISO/IEC 40500 / WCAG 2.2',
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
    const status = statusForCategory(category);
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
      statusLabel: status === 'confirmed' ? 'Confirmado' : 'Requiere revision',
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
        nameEs: 'Idioma de pagina no definido',
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
        description: 'La pagina no identifica explicitamente el contenido principal con main o role="main".',
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
        description: 'La pagina no identifica explicitamente la navegacion principal con nav o role="navigation".',
        element: document.body,
        severity: 'medio',
        suggestedFix: 'Encerrar la navegacion principal en nav o agregar role="navigation".',
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
        nameEs: 'Falta metodo para saltar bloques',
        description: 'La pagina parece no tener un enlace para saltar al contenido principal.',
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
        suggestedFix: 'Eliminar el li vacio o marcarlo como decorativo si no transmite informacion.',
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
        suggestedFix: 'Usar href valido para enlaces o cambiarlo por button si ejecuta una accion.',
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
        nameEs: 'Boton sin nombre accesible',
        description: 'El control con funcion de boton no tiene nombre programatico.',
        element,
        severity: 'alto',
        suggestedFix: 'Agregar texto visible, aria-label o aria-labelledby que describa la accion.',
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
            description: 'Un campo que solicita datos del usuario no tiene autocomplete especifico.',
            element,
            severity: 'medio',
            suggestedFix: 'Agregar autocomplete apropiado segun el proposito del campo, por ejemplo name, email, tel o address-line1.',
          });
        }
      }
      if (element.labels && element.labels.length > 1) {
        push({
          ruleId: 'form-control-multiple-labels',
          category: 'alert',
          criterion: '3.3.2',
          level: 'A',
          nameEs: 'Control con multiples etiquetas',
          description: 'El control tiene mas de un label asociado.',
          element,
          severity: 'medio',
          suggestedFix: 'Mantener un solo label programatico y mover ayudas adicionales a aria-describedby.',
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
        description: 'Un widget ARIA no tiene nombre accesible programatico.',
        element,
        severity: 'alto',
        suggestedFix: 'Agregar aria-label o aria-labelledby apuntando a un titulo visible.',
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
        nameEs: 'Proposito de tabla no claro',
        description: 'No se puede determinar si la tabla es de datos o de maquetacion.',
        element,
        severity: 'medio',
        suggestedFix: 'Si es tabla de datos, agregar th/caption. Si es maquetacion, reemplazar por CSS o usar role="presentation".',
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
        suggestedFix: 'Mover la informacion a texto visible o a una descripcion programatica adecuada.',
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
        description: 'El contraste del texto sobre una imagen de fondo requiere revision humana.',
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
          description: `El id "${element.id}" aparece mas de una vez en la pagina.`,
          element,
          severity: 'alto',
          suggestedFix: 'Asignar ids unicos y actualizar las referencias for, aria-labelledby o aria-controls.',
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
          nameEs: 'Iframe sin titulo',
          description: 'El iframe no tiene atributo title que describa su contenido o proposito a lectores de pantalla.',
          element,
          severity: 'alto',
          suggestedFix: 'Agregar title descriptivo al iframe, por ejemplo title="Mapa de ubicacion de la oficina" o title="Video tutorial de registro".',
        });
      } else {
        push({
          ruleId: 'frame-tested',
          category: 'manual_check',
          criterion: 'Revision manual',
          level: 'A',
          nameEs: 'Contenido de iframe sin evaluar',
          description: 'El iframe "' + title + '" tiene titulo pero su contenido interno no puede ser auditado automaticamente desde la extension.',
          element,
          severity: 'medio',
          suggestedFix: 'Abrir la URL del iframe directamente y ejecutar el escaner sobre ella, o revisar manualmente contraste, teclado y texto alternativo dentro del iframe.',
        });
      }
    });

    return findings.slice(0, 220);
  };

  // IBM Equal Access engine — runs if ace.js was injected; gracefully skips otherwise
  const collectIbmFindings = async () => {
    if (!window.ace || !window.ace.Checker) return [];
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
          statusLabel: status === 'confirmed' ? 'Confirmado' : 'Requiere revision',
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

      return findings.slice(0, 250);
    } catch (err) {
      console.warn('Sin Barreras: IBM Equal Access no pudo completar el analisis.', err && err.message);
      return [];
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

  const collectFocusTraversal = () => {
    const focusables = Array.from(document.querySelectorAll([
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'summary'
    ].join(','))).filter((element) => !element.disabled && isVisible(element));

    const steps = focusables.slice(0, 80).map((element, index) => {
      const rect = element.getBoundingClientRect();
      const name = accessibleName(element);
      const hasName = Boolean(name);
      const status = hasName ? 'ok' : 'warning';
      return {
        index: index + 1,
        selector: selectorFor(element),
        elementHtml: element.outerHTML.slice(0, MAX_HTML_SAMPLE),
        text: textOf(element).slice(0, 160),
        tagName: element.tagName.toLowerCase(),
        role: inferRole(element),
        accessibleName: name,
        rect: {
          x: Math.max(0, Math.round(rect.x)),
          y: Math.max(0, Math.round(rect.y)),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        status,
        issue: hasName ? 'Flujo correcto con nombre accesible.' : 'Elemento enfocable sin nombre accesible claro.',
        suggestedFix: hasName
          ? 'Mantener el orden de foco y el indicador visible.'
          : 'Agregar texto visible, aria-label o aria-labelledby que describa la accion.',
      };
    });

    return {
      screenshotUrl: '',
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageSize: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      steps,
      summary: {
        total: steps.length,
        ok: steps.filter((step) => step.status === 'ok').length,
        warning: steps.filter((step) => step.status === 'warning').length,
        error: steps.filter((step) => step.status === 'error').length,
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
        suggestedFix: warning ? 'Agregar nombre accesible mediante titulo visible, aria-label o aria-labelledby.' : 'Mantener la estructura semantica.',
      });
    };

    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((element) => {
      push('heading', element, { level: Number(element.tagName.slice(1)), label: textOf(element) || element.tagName });
    });
    document.querySelectorAll('main,nav,header,footer,aside,section[aria-label],section[aria-labelledby],[role="main"],[role="navigation"],[role="banner"],[role="contentinfo"],[role="complementary"]').forEach((element) => push('landmark', element));
    document.querySelectorAll('form').forEach((element) => push('form', element));
    document.querySelectorAll('table').forEach((element) => push('table', element));
    document.querySelectorAll('iframe').forEach((element) => push('iframe', element));
    document.querySelectorAll('button,a[href],input,select,textarea').forEach((element) => push('interactive', element));

    return {
      items: items.slice(0, 140),
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
    const hasDragHandler = all('*').some((element) => {
      const attrs = Array.from(element.attributes || []).map((attr) => attr.name.toLowerCase());
      return attrs.some((name) => name.startsWith('ondrag'));
    });
    const hasImageText = all('img').some((img) => {
      const alt = (img.getAttribute('alt') || '').trim();
      return alt.split(/\s+/).length >= 4 || /texto|logo|banner|titulo|title/i.test(alt);
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

  window.__sinBarrerasAuditCurrentPage = async () => {
    if (!window.axe) {
      throw new Error('axe-core no esta disponible en la pestana.');
    }

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
    const ibmFindings = await collectIbmFindings();
    const allFindings = dedupeFindings([...axeViolations, ...axeManualVerifications, ...heuristicFindings, ...ibmFindings]);
    const violations = allFindings.filter((finding) => finding.findingStatus === 'confirmed');
    const manualVerifications = allFindings.filter((finding) => finding.findingStatus !== 'confirmed');

    const contentDetection = collectContentDetection();
    const score = scoreFromFindings(violations, manualVerifications, contentDetection);
    const visualMarkers = [...violations, ...manualVerifications]
      .filter((finding) => finding.visualRect && finding.visualRect.width > 0 && finding.visualRect.height > 0)
      .slice(0, 80)
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
          status: ibmFindings.length >= 0 ? 'ok' : 'skip',
          durationMs: 0,
          findingsCount: ibmFindings.length,
        },
      ],
      focusTraversal: collectFocusTraversal(),
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
