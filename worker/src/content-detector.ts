import { Page } from 'playwright';

export interface ContentDetection {
  tiene_imagenes: boolean;
  tiene_svg_funcional: boolean;
  tiene_video: boolean;
  tiene_audio: boolean;
  tiene_audio_autoplay: boolean;
  tiene_formularios: boolean;
  tiene_inputs_texto: boolean;
  tiene_select: boolean;
  tiene_checkboxes_radios: boolean;
  tiene_autenticacion: boolean;
  tiene_captcha: boolean;
  tiene_enlaces: boolean;
  tiene_tablas: boolean;
  tiene_encabezados: boolean;
  tiene_iframes: boolean;
  tiene_drag_and_drop: boolean;
  tiene_animaciones_css: boolean;
  tiene_movimiento_automatico: boolean;
  tiene_contenido_hover: boolean;
  tiene_timeout_sesion: boolean;
  tiene_mensajes_estado: boolean;
  tiene_contenido_multipagina: boolean;
  tiene_proceso_multipaso: boolean;
  tiene_transacciones: boolean;
  tiene_imagenes_de_texto: boolean;
  tiene_ayuda: boolean;
  es_dominio_gob_pe: boolean;
}

export async function detectPageContent(page: Page): Promise<ContentDetection> {
  return await page.evaluate(`(() => {
    const q = (selector) => !!document.querySelector(selector);
    const text = document.body?.innerText?.toLowerCase() || '';
    const all = (selector) => Array.from(document.querySelectorAll(selector));
    const allElements = all('*').slice(0, 2000);
    const hasAnimation = allElements.some((el) => {
      const style = window.getComputedStyle(el);
      return style.animationName && style.animationName !== 'none' || style.transitionDuration && style.transitionDuration !== '0s';
    });
    const hasDragHandler = allElements.some((el) => {
      const attrs = Array.from(el.attributes || []).map((a) => a.name.toLowerCase());
      return attrs.some((name) => name.startsWith('ondrag'));
    });
    const hasImageText = all('img').some((img) => {
      const alt = (img.getAttribute('alt') || '').trim();
      return alt.split(/\\s+/).length >= 4 || /texto|logo|banner|titulo|título/i.test(alt);
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
      tiene_proceso_multipaso: q('[data-step], .wizard, .step, .stepper') || /paso\\s+\\d|siguiente|anterior/.test(text),
      tiene_transacciones: /pago|compra|checkout|carrito|tarjeta|transferencia|firma|declaraci[oó]n jurada|datos personales|dni/.test(text),
      tiene_imagenes_de_texto: hasImageText,
      tiene_ayuda: q('a[href*="ayuda"], a[href*="help"], a[href*="contacto"], [aria-label*="ayuda" i], [aria-label*="help" i]'),
      es_dominio_gob_pe: window.location.hostname.endsWith('.gob.pe'),
    };
  })()`) as ContentDetection;
}
