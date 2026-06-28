import type { Page } from 'playwright';
import type { FocusTraversalReport, FocusTraversalStep } from './scanner-models.js';
import { uploadEvidence } from './storage.js';

declare const window: any;
declare const document: any;
declare const CSS: any;
declare const Node: any;

const MAX_FOCUS_STEPS = 40;

function summarizeSteps(steps: FocusTraversalStep[]) {
  return {
    total: steps.length,
    ok: steps.filter((step) => step.status === 'ok').length,
    warning: steps.filter((step) => step.status === 'warning').length,
    error: steps.filter((step) => step.status === 'error').length,
  };
}

export async function captureFocusTraversal(page: Page): Promise<FocusTraversalReport | null> {
  try {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const active = document.activeElement as any;
      active?.blur?.();
      document.body?.focus?.();
    });

    const steps: FocusTraversalStep[] = [];
    const seen = new Set<string>();

    for (let index = 1; index <= MAX_FOCUS_STEPS; index++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(80);

      const step = await page.evaluate((stepIndex) => {
        const active = document.activeElement as any;
        if (!active || active === document.body || active === document.documentElement) return null;

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
            const siblings = Array.from(parent.children as any[]).filter((child: any) => child.tagName === node!.tagName);
            const nth = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : '';
            parts.unshift(`${tag}${nth}`);
            node = parent;
          }
          return parts.join(' > ') || element.tagName.toLowerCase();
        };

        const style = window.getComputedStyle(active);
        const rect = active.getBoundingClientRect();
        const doc = document.documentElement;
        const outlineWidth = Number.parseFloat(style.outlineWidth || '0');
        const hasOutline = outlineWidth >= 2 && style.outlineStyle !== 'none' && style.outlineColor !== 'transparent';
        const hasBoxShadow = style.boxShadow && style.boxShadow !== 'none';
        const hasVisibleFocus = hasOutline || hasBoxShadow;
        const isHidden =
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.visibility === 'hidden' ||
          style.display === 'none' ||
          active.getAttribute('aria-hidden') === 'true';

        let status: 'ok' | 'warning' | 'error' = 'ok';
        let issue = 'Flujo correcto con foco visible.';
        let suggestedFix = 'Mantener el orden de foco y el indicador visible.';

        if (isHidden) {
          status = 'error';
          issue = 'El foco llega a un elemento oculto o sin area visible.';
          suggestedFix = 'Quitar el elemento oculto del orden de tabulacion o hacerlo visible cuando recibe foco.';
        } else if (!hasVisibleFocus) {
          status = 'warning';
          issue = 'El elemento recibe foco, pero no se detecta un indicador visual claro.';
          suggestedFix = 'Agregar :focus-visible con outline de alto contraste y al menos 2 px de grosor.';
        }

        return {
          index: stepIndex,
          selector: getSelector(active),
          elementHtml: active.outerHTML.slice(0, 1200),
          text: (active.textContent || active.getAttribute('value') || '').replace(/\s+/g, ' ').trim().slice(0, 160),
          tagName: active.tagName.toLowerCase(),
          role: active.getAttribute('role') || '',
          accessibleName: active.getAttribute('aria-label') || active.getAttribute('title') || (active.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          rect: {
            x: Math.max(0, rect.left + window.scrollX),
            y: Math.max(0, rect.top + window.scrollY),
            width: Math.max(1, rect.width),
            height: Math.max(1, rect.height),
          },
          status,
          issue,
          suggestedFix,
          pageSize: {
            width: Math.max(doc.scrollWidth, window.innerWidth),
            height: Math.max(doc.scrollHeight, window.innerHeight),
          },
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        };
      }, index);

      if (!step) continue;
      const key = `${step.selector}-${Math.round(step.rect.x)}-${Math.round(step.rect.y)}`;
      if (seen.has(key)) break;
      seen.add(key);

      const previous = steps[steps.length - 1];
      if (previous && step.status === 'ok') {
        const backwardsJump = step.rect.y + 80 < previous.rect.y;
        const farJump = Math.abs(step.rect.y - previous.rect.y) > step.viewport.height * 1.35;
        if (backwardsJump || farJump) {
          step.status = 'error';
          step.issue = 'El recorrido de Tab presenta un salto visual que puede desorientar.';
          step.suggestedFix = 'Reordenar el DOM o ajustar tabindex para que el foco avance siguiendo el orden visual y de lectura.';
        }
      }

      steps.push(step);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    const screenshot = await page.screenshot({ fullPage: true });
    let screenshotUrl: string | undefined;
    try {
      screenshotUrl = await uploadEvidence(`focus-map-${Date.now()}.png`, screenshot, 'image/png');
    } catch (uploadErr) {
      console.warn('Focus map screenshot upload failed; continuing without it.', uploadErr);
    }
    const first = steps[0] as any;

    return {
      screenshotUrl,
      viewport: first?.viewport || { width: 1280, height: 800 },
      pageSize: first?.pageSize || { width: 1280, height: 800 },
      steps,
      summary: summarizeSteps(steps),
    };
  } catch (err) {
    console.warn('Focus traversal capture failed; continuing without focus map.', err);
    return null;
  }
}
