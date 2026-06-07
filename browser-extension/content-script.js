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
    const value = String(ruleId || '').toLowerCase();
    const text = `${value} ${String(description || '').toLowerCase()}`;
    if (text.includes('landmark') && text.includes('main')) return 'landmark-main-missing';
    if (text.includes('landmark') && text.includes('nav')) return 'landmark-nav-missing';
    if (text.includes('bypass') || text.includes('skip')) return 'bypass-missing';
    if (text.includes('lang') && text.includes('html')) return 'html-lang-missing';
    if (text.includes('listbox') && text.includes('option')) return 'aria-required-owned-element';
    if (text.includes('required owned') || text.includes('owned element')) return 'aria-required-owned-element';
    if (text.includes('button') && (text.includes('label') || text.includes('name'))) return 'button-name-missing';
    if (text.includes('link') && (text.includes('text') || text.includes('name'))) return 'link-name-missing';
    if (text.includes('input') && text.includes('accessible name')) return 'input-name-missing';
    if (text.includes('missing href')) return 'link-href-missing';
    if (text.includes('empty list')) return 'empty-list-item';
    if (text.includes('unknown table')) return 'table-purpose-review';
    if (text.includes('title') && text.includes('non-interactive')) return 'title-non-interactive';
    if (text.includes('autocomplete')) return 'autocomplete-missing';
    if (text.includes('multiple') && text.includes('label')) return 'form-control-multiple-labels';
    if (text.includes('required') && text.includes('html5')) return 'required-html5-indicator';
    if (text.includes('image background')) return 'contrast-image-background-undetermined';
    if (text.includes('duplicate') && text.includes('id')) return 'duplicate-id';
    return value || 'manual-review';
  };

  const statusForCategory = (category) => category === 'violation' ? 'confirmed' : 'needs_review';

  const suggestedFixForRule = (ruleId, fallback = '') => {
    const normalized = normalizeRuleId(ruleId, fallback);
    const fixes = {
      'html-lang-missing': 'Agregar en el elemento html un atributo lang valido segun el idioma principal, por ejemplo lang="es". Si hay fragmentos en otro idioma, marcarlos con lang propio.',
      'landmark-main-missing': 'Envolver el contenido principal con un unico <main id="main-content"> o role="main"; no incluir header, nav ni footer repetitivos dentro del main.',
      'landmark-nav-missing': 'Marcar la navegacion principal con <nav aria-label="Navegacion principal"> o role="navigation" con nombre accesible si hay mas de una navegacion.',
      'bypass-missing': 'Agregar antes del encabezado un enlace "Saltar al contenido principal" que apunte a #main-content, sea visible al recibir foco y funcione con teclado.',
      'empty-list-item': 'Eliminar el <li> vacio. Si se usa solo para separacion o decoracion, mover ese efecto a CSS; las listas deben contener elementos con significado.',
      'link-href-missing': 'Si el elemento navega, usar <a href="..."> con destino valido. Si ejecuta una accion sin navegar, reemplazarlo por <button type="button"> accesible por teclado.',
      'link-name-missing': 'Agregar texto de enlace visible y especifico que indique destino o accion. Si es solo icono, usar aria-label que incluya el proposito visible.',
      'button-name-missing': 'Agregar nombre accesible al boton. Preferir texto visible; en botones solo icono usar aria-label que describa la accion, por ejemplo "Cerrar modal".',
      'input-name-missing': 'Asociar cada control con un <label for="id"> visible. Usar aria-labelledby si ya existe texto visible; usar aria-describedby solo para ayudas o errores.',
      'required-html5-indicator': 'Mantener required si aplica, pero agregar una indicacion visible antes del envio, por ejemplo texto "Obligatorio", y asegurar que el error sea anunciado.',
      'autocomplete-missing': 'Agregar un token autocomplete especifico segun el dato solicitado, por ejemplo name, given-name, family-name, email, tel, address-line1 o one-time-code.',
      'form-control-multiple-labels': 'Dejar un solo label programatico asociado al campo. Mover instrucciones, ejemplos y mensajes de error a elementos referenciados con aria-describedby.',
      'aria-required-owned-element': 'Corregir el patron ARIA: el contenedor debe tener los roles hijos obligatorios, por ejemplo listbox > option. Si no es un widget real, quitar el role ARIA y usar HTML nativo.',
      'aria-widget-name-missing': 'Agregar nombre accesible al widget con aria-labelledby apuntando a un titulo visible. Usar aria-label solo si no existe texto visible adecuado.',
      'table-purpose-review': 'Determinar si la tabla es de datos o maquetacion. Si es de datos, agregar caption, th y scope; si es maquetacion, reemplazar por CSS o usar role="presentation".',
      'title-non-interactive': 'No depender de title para informacion importante. Mostrar el texto de forma visible o asociarlo con aria-describedby a un control relacionado.',
      'contrast-image-background-undetermined': 'Revisar el contraste sobre la captura real. Si no alcanza 4.5:1 en texto normal, agregar capa solida/semitransparente o cambiar texto/fondo; no depender solo de sombra.',
      'duplicate-id': 'Usar identificadores id unicos en toda la pagina y actualizar referencias asociadas como for, aria-labelledby, aria-controls o href="#id".',
    };
    if (fixes[normalized]) return fixes[normalized];
    if (normalized.includes('color-contrast')) return 'Ajustar los colores de texto y fondo para cumplir contraste WCAG AA: 4.5:1 en texto normal o 3:1 en texto grande.';
    if (normalized.includes('image-alt')) return 'Si la imagen transmite informacion, agregar alt descriptivo y breve. Si es decorativa, dejar alt="" y evitar aria-hidden en imagenes informativas.';
    if (normalized.includes('aria')) return 'Corregir nombre, rol, valor y referencias ARIA. Preferir HTML nativo cuando sea posible y validar con lector de pantalla o arbol de accesibilidad.';
    return fallback && fallback.length > 80
      ? `${fallback} Revisar el elemento concreto y aplicar la correccion indicada por el criterio WCAG asociado.`
      : 'Revisar el elemento concreto, aplicar el patron WCAG correspondiente y validar nuevamente con teclado, lector de pantalla o contraste segun el caso.';
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
    return {
      tool: 'axe-extension',
      ruleId: rule.id,
      normalizedRuleId: normalizeRuleId(rule.id, rule.description || rule.help),
      category,
      sourceCategory: category,
      criterion,
      wcagCriterion: criterion,
      level,
      wcagLevel: level,
      nameEs: rule.help || rule.id,
      disability: [],
      role: 'Desarrollador',
      severity: impactToSeverity(rule.impact),
      findingStatus: status,
      status,
      statusLabel: status === 'confirmed' ? 'Confirmado' : 'Requiere revision',
      pageState: PAGE_STATE,
      pageStateLabel: PAGE_STATE_LABEL,
      description: rule.description || rule.help || rule.id,
      elementHtml: (node.html || '').slice(0, MAX_HTML_SAMPLE),
      selector: target || 'document',
      screenshotUrl: '',
      suggestedFix: suggestedFixForRule(rule.id, rule.description || rule.help || ''),
      resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2',
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

    document.querySelectorAll('*').forEach((element) => {
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

    return findings.slice(0, 220);
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

  const scoreFromFindings = (violations, reviews) => {
    const confirmedCriteria = new Set(violations.map((finding) => finding.wcagCriterion || finding.criterion));
    const reviewCriteria = new Set(reviews.map((finding) => finding.wcagCriterion || finding.criterion));
    return Math.max(0, Math.min(100, Math.round(100 - confirmedCriteria.size * 5 - reviewCriteria.size * 1.5)));
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
    const allFindings = dedupeFindings([...axeViolations, ...axeManualVerifications, ...heuristicFindings]);
    const violations = allFindings.filter((finding) => finding.findingStatus === 'confirmed');
    const manualVerifications = allFindings.filter((finding) => finding.findingStatus !== 'confirmed');

    const score = scoreFromFindings(violations, manualVerifications);
    const contentDetection = collectContentDetection();
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
          applicableCount: 86,
          notApplicableCount: 0,
          failedCount: new Set(violations.map((item) => item.wcagCriterion)).size,
          reviewCount: new Set(manualVerifications.map((item) => item.wcagCriterion)).size,
          passedCount: Math.max(0, 86 - new Set(violations.map((item) => item.wcagCriterion)).size),
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
