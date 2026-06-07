import type { Page } from 'playwright';
import type { SemanticStructureItem, SemanticStructureReport } from './scanner-models.js';

declare const window: any;
declare const document: any;
declare const CSS: any;
declare const Node: any;

function summarizeStructure(items: SemanticStructureItem[]): SemanticStructureReport['summary'] {
  return {
    headings: items.filter((item) => item.kind === 'heading').length,
    landmarks: items.filter((item) => item.kind === 'landmark').length,
    forms: items.filter((item) => item.kind === 'form').length,
    tables: items.filter((item) => item.kind === 'table').length,
    iframes: items.filter((item) => item.kind === 'iframe').length,
    interactive: items.filter((item) => item.kind === 'interactive').length,
    warnings: items.filter((item) => item.status === 'warning').length,
    errors: items.filter((item) => item.status === 'error').length,
  };
}

export async function captureSemanticStructure(page: Page): Promise<SemanticStructureReport | null> {
  try {
    const items = await page.evaluate(() => {
      const getSelector = (element: any) => {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const testId = element.getAttribute('data-testid');
        if (testId) return `${element.tagName.toLowerCase()}[data-testid="${CSS.escape(testId)}"]`;
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
        const name = element.getAttribute('name');
        if (name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;

        const parts: string[] = [];
        let node: any = element;
        while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body && parts.length < 4) {
          const parent = node.parentElement;
          const tag = node.tagName.toLowerCase();
          if (!parent) {
            parts.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children as any[]).filter((child: any) => child.tagName === node.tagName);
          const nth = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : '';
          parts.unshift(`${tag}${nth}`);
          node = parent;
        }
        return parts.join(' > ') || element.tagName.toLowerCase();
      };

      const isVisible = (element: any) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || '1') > 0.05
          && rect.width > 0
          && rect.height > 0;
      };

      const getAccessibleName = (element: any) => {
        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
          const text = labelledBy
            .split(/\s+/)
            .map((id: string) => document.getElementById(id)?.textContent || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (text) return text;
        }
        return (
          element.getAttribute('aria-label') ||
          element.getAttribute('title') ||
          element.getAttribute('alt') ||
          (element.textContent || '').replace(/\s+/g, ' ').trim()
        ).slice(0, 180);
      };

      const allItems: SemanticStructureItem[] = [];
      const pushItem = (item: Omit<SemanticStructureItem, 'index'>) => {
        allItems.push({ ...item, index: allItems.length + 1 });
      };

      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(isVisible);
      let previousHeadingLevel = 0;
      for (const heading of headings as any[]) {
        const level = Number(heading.tagName.slice(1));
        let status: SemanticStructureItem['status'] = 'ok';
        let issue = 'Encabezado presente en la estructura de lectura.';
        let suggestedFix = 'Mantener una jerarquia progresiva y descriptiva.';
        const text = getAccessibleName(heading);

        if (!text) {
          status = 'error';
          issue = 'Encabezado sin texto accesible.';
          suggestedFix = 'Agregar texto visible y descriptivo al encabezado.';
        } else if (previousHeadingLevel > 0 && level > previousHeadingLevel + 1) {
          status = 'warning';
          issue = `Salto de jerarquia: pasa de H${previousHeadingLevel} a H${level}.`;
          suggestedFix = 'Evitar saltos de encabezado para conservar una estructura comprensible.';
        }
        previousHeadingLevel = level;

        pushItem({
          kind: 'heading',
          label: `H${level}`,
          level,
          selector: getSelector(heading),
          accessibleName: text,
          text,
          status,
          issue,
          suggestedFix,
        });
      }

      const h1Count = headings.filter((heading: any) => heading.tagName.toLowerCase() === 'h1').length;
      if (h1Count === 0) {
        pushItem({
          kind: 'heading',
          label: 'H1',
          level: 1,
          selector: 'body',
          accessibleName: '',
          text: 'Sin H1',
          status: 'error',
          issue: 'La pagina no tiene un H1 visible para identificar el contenido principal.',
          suggestedFix: 'Agregar un H1 unico y descriptivo dentro del contenido principal.',
        });
      } else if (h1Count > 1) {
        pushItem({
          kind: 'heading',
          label: 'H1',
          level: 1,
          selector: 'body',
          accessibleName: '',
          text: `${h1Count} H1 detectados`,
          status: 'warning',
          issue: 'La pagina tiene multiples H1 visibles.',
          suggestedFix: 'Usar un H1 principal y bajar los demas a H2/H3 segun jerarquia.',
        });
      }

      const landmarkSelectors = [
        'header',
        'nav',
        'main',
        'aside',
        'footer',
        'section[aria-label]',
        'section[aria-labelledby]',
        '[role="banner"]',
        '[role="navigation"]',
        '[role="main"]',
        '[role="complementary"]',
        '[role="contentinfo"]',
        '[role="search"]',
        '[role="region"]',
      ].join(',');
      const landmarks = Array.from(new Set(document.querySelectorAll(landmarkSelectors))).filter(isVisible);
      for (const landmark of landmarks as any[]) {
        const tag = landmark.tagName.toLowerCase();
        const role = landmark.getAttribute('role') || tag;
        const name = getAccessibleName(landmark);
        const needsName = role === 'region' || tag === 'section';
        pushItem({
          kind: 'landmark',
          label: role,
          role,
          selector: getSelector(landmark),
          accessibleName: name,
          text: name,
          status: needsName && !name ? 'warning' : 'ok',
          issue: needsName && !name ? 'Region o seccion sin nombre accesible.' : 'Landmark detectado.',
          suggestedFix: needsName && !name ? 'Agregar aria-label o aria-labelledby descriptivo.' : 'Mantener landmarks claros y no duplicados.',
        });
      }

      const hasMain = landmarks.some((landmark: any) => landmark.tagName.toLowerCase() === 'main' || landmark.getAttribute('role') === 'main');
      const hasNav = landmarks.some((landmark: any) => landmark.tagName.toLowerCase() === 'nav' || landmark.getAttribute('role') === 'navigation');
      if (!hasMain) {
        pushItem({
          kind: 'landmark',
          label: 'main',
          role: 'main',
          selector: 'body',
          accessibleName: '',
          text: 'Sin main',
          status: 'error',
          issue: 'No se detecto landmark principal main/role=main.',
          suggestedFix: 'Envolver el contenido principal con main o role="main".',
        });
      }
      if (!hasNav) {
        pushItem({
          kind: 'landmark',
          label: 'navigation',
          role: 'navigation',
          selector: 'body',
          accessibleName: '',
          text: 'Sin nav',
          status: 'warning',
          issue: 'No se detecto navegacion principal nav/role=navigation.',
          suggestedFix: 'Identificar la navegacion principal con nav o role="navigation".',
        });
      }

      for (const form of Array.from(document.querySelectorAll('form')).filter(isVisible) as any[]) {
        const name = getAccessibleName(form);
        pushItem({
          kind: 'form',
          label: 'form',
          selector: getSelector(form),
          accessibleName: name,
          text: name,
          status: name ? 'ok' : 'warning',
          issue: name ? 'Formulario identificado.' : 'Formulario sin nombre accesible.',
          suggestedFix: name ? 'Mantener etiquetas claras en sus controles.' : 'Nombrar el formulario con aria-label o aria-labelledby.',
        });
      }

      for (const table of Array.from(document.querySelectorAll('table')).filter(isVisible) as any[]) {
        const caption = table.querySelector('caption')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        pushItem({
          kind: 'table',
          label: 'table',
          selector: getSelector(table),
          accessibleName: caption,
          text: caption,
          status: caption ? 'ok' : 'warning',
          issue: caption ? 'Tabla con caption.' : 'Tabla sin caption descriptivo.',
          suggestedFix: caption ? 'Mantener encabezados th y scope correctamente.' : 'Agregar caption o nombre accesible a la tabla.',
        });
      }

      for (const iframe of Array.from(document.querySelectorAll('iframe')).filter(isVisible) as any[]) {
        const title = iframe.getAttribute('title') || '';
        pushItem({
          kind: 'iframe',
          label: 'iframe',
          selector: getSelector(iframe),
          accessibleName: title,
          text: title,
          status: title ? 'ok' : 'error',
          issue: title ? 'Iframe con title.' : 'Iframe sin title descriptivo.',
          suggestedFix: title ? 'Mantener title claro y especifico.' : 'Agregar title no vacio que describa el contenido del iframe.',
        });
      }

      const controls = Array.from(document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])')).filter(isVisible);
      for (const control of controls.slice(0, 80) as any[]) {
        const name = getAccessibleName(control);
        const tag = control.tagName.toLowerCase();
        const role = control.getAttribute('role') || tag;
        pushItem({
          kind: 'interactive',
          label: role,
          role,
          selector: getSelector(control),
          accessibleName: name,
          text: name,
          status: name ? 'ok' : 'warning',
          issue: name ? 'Elemento interactivo con nombre accesible.' : 'Elemento interactivo sin nombre accesible claro.',
          suggestedFix: name ? 'Mantener el nombre accesible alineado con el texto visible.' : 'Agregar texto visible, label, aria-label o aria-labelledby segun corresponda.',
        });
      }

      return allItems;
    });

    return {
      items,
      summary: summarizeStructure(items),
    };
  } catch (err) {
    console.warn('Semantic structure capture failed; continuing without structure report.', err);
    return null;
  }
}
