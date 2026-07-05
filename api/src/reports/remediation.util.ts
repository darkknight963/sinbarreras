/**
 * Utilidades de remediación compartidas por los exports (PDF ejecutivo,
 * PDF técnico y matriz Excel). Espejo del generador del frontend
 * (ScanReportView): transformaciones DETERMINÍSTICAS sobre el HTML real del
 * hallazgo — nunca se inventa contenido; lo que solo el dueño del sitio
 * conoce va como placeholder [entre corchetes].
 * Solo se ejecuta al generar un export (costo puntual ya existente).
 */

// ── Manipulación de atributos sobre la etiqueta de apertura ──
const setTagAttribute = (html: string, attr: string, value: string): string | null => {
  const match = html.match(/^\s*<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/);
  if (!match) return null;
  let attrs = match[2];
  const existing = new RegExp(`\\s${attr}\\s*=\\s*("[^"]*"|'[^']*')`, 'i');
  if (existing.test(attrs)) {
    attrs = attrs.replace(existing, ` ${attr}="${value}"`);
  } else {
    attrs = `${attrs} ${attr}="${value}"`;
  }
  return `<${match[1]}${attrs}>${html.slice(match[0].length)}`;
};

const getTagAttribute = (html: string, attr: string): string | null => {
  const match = html.match(new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[1] ?? match[2] ?? '') : null;
};

// ── Contraste: luminancia WCAG y color más cercano que cumple ──
type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb | null => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};

const rgbToHex = (rgb: Rgb) =>
  '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

const relativeLuminance = ([r, g, b]: Rgb) => {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (a: Rgb, b: Rgb) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

const mixToward = (from: Rgb, to: Rgb, t: number): Rgb =>
  [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * t) as Rgb;

const nearestCompliantColor = (fg: Rgb, bg: Rgb, target: number) => {
  const directions: Rgb[] = [[0, 0, 0], [255, 255, 255]];
  let best: { hex: string; ratio: number; t: number } | null = null;
  for (const dir of directions) {
    if (contrastRatio(mixToward(fg, dir, 1), bg) < target) continue;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (contrastRatio(mixToward(fg, dir, mid), bg) >= target) hi = mid;
      else lo = mid;
    }
    const candidate = mixToward(fg, dir, hi);
    const ratio = contrastRatio(candidate, bg);
    if (!best || hi < best.t) best = { hex: rgbToHex(candidate), ratio: Math.round(ratio * 100) / 100, t: hi };
  }
  return best;
};

const buildContrastSuggestion = (finding: Record<string, any>, enhanced: boolean) => {
  const message = String(finding?.elementFix || finding?.description || '');
  const hexes = message.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  const [fgHex, bgHex] = hexes;
  if (!fgHex || !bgHex) return null;
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const isLarge = /grande|large/i.test(message);
  const target = enhanced ? (isLarge ? 4.5 : 7) : (isLarge ? 3 : 4.5);
  if (contrastRatio(fg, bg) >= target) return null;
  const fixed = nearestCompliantColor(fg, bg, target);
  if (!fixed) return null;
  return {
    code: `color: ${fixed.hex}; /* antes ${fgHex} — ratio ${fixed.ratio}:1 sobre ${bgHex} */`,
    note: `Color de texto más cercano al original que cumple ${target}:1. También puedes oscurecer/aclarar el fondo.`,
  };
};

const inferAutocompleteToken = (html: string): string => {
  const type = (getTagAttribute(html, 'type') || '').toLowerCase();
  const nameAttr = ((getTagAttribute(html, 'name') || '') + ' ' + (getTagAttribute(html, 'id') || '')).toLowerCase();
  if (type === 'email' || /mail|correo/.test(nameAttr)) return 'email';
  if (type === 'tel' || /tel|phone|celular|movil/.test(nameAttr)) return 'tel';
  if (type === 'password' || /pass|clave|contrasena/.test(nameAttr)) return 'current-password';
  if (/nombre|name/.test(nameAttr)) return 'name';
  if (/direccion|address/.test(nameAttr)) return 'street-address';
  return '[token: ver lista en MDN autocomplete]';
};

const buildLabelSnippet = (html: string) => {
  const id = getTagAttribute(html, 'id');
  if (id) {
    return { code: `<label for="${id}">[Etiqueta del campo]</label>\n${html}` };
  }
  const withId = setTagAttribute(html, 'id', 'campo-1');
  if (!withId) return null;
  return {
    code: `<label for="campo-1">[Etiqueta del campo]</label>\n${withId}`,
    note: 'Se agregó id="campo-1" para poder asociar el label — usa un id único real.',
  };
};

export interface CorrectedSnippet {
  code: string;
  note?: string;
}

export const buildCorrectedSnippet = (finding: Record<string, any>): CorrectedSnippet | null => {
  const key = String(finding?.normalizedRuleId || finding?.ruleId || '').toLowerCase();
  const html = String(finding?.elementHtml || '').trim();
  const withAttr = (attr: string, value: string, note?: string): CorrectedSnippet | null => {
    if (!html) return null;
    const code = setTagAttribute(html, attr, value);
    return code ? { code, note } : null;
  };

  switch (key) {
    case 'image-alt':
    case 'image-ignored-review':
      return withAttr('alt', '[describe qué muestra esta imagen]',
        'Si la imagen es solo decorativa, usa alt="" (vacío) en su lugar.');
    case 'input-image-alt':
      return withAttr('alt', '[acción del botón, ej. Buscar]');
    case 'area-alt':
      return withAttr('alt', '[destino de esta área del mapa]');
    case 'html-has-lang':
    case 'html-lang-missing':
      return { code: '<html lang="es">', note: 'Usa lang="es-PE" para contenido peruano. Va en la etiqueta <html> raíz.' };
    case 'html-lang-valid':
      return withAttr('lang', 'es', 'El valor debe ser un código BCP 47 válido: es, es-PE, en, qu (quechua)…');
    case 'document-title':
      return { code: '<title>[Nombre de esta página] | [Nombre del sitio]</title>', note: 'Va dentro de <head>. Máximo ~60 caracteres.' };
    case 'iframe-title':
    case 'frame-title':
      return withAttr('title', '[qué contenido muestra este iframe]');
    case 'button-name':
    case 'button-name-missing':
      return withAttr('aria-label', '[acción del botón, ej. Cerrar menú]',
        'Mejor aún: agrega texto visible dentro del botón; aria-label es para botones de solo icono.');
    case 'link-name':
    case 'link-name-missing':
      return withAttr('aria-label', '[a dónde lleva este enlace]',
        'Mejor aún: agrega texto visible al enlace; evita "clic aquí" o "ver más".');
    case 'select-name':
    case 'textarea-name':
    case 'input-name-missing':
    case 'form-field-label-missing':
    case 'label':
      return html ? buildLabelSnippet(html) : null;
    case 'duplicate-id': {
      const id = getTagAttribute(html, 'id');
      if (!id) return null;
      const code = setTagAttribute(html, 'id', `${id}-2`);
      return code ? { code, note: `Actualiza también los for/aria-labelledby/aria-controls que referencien "${id}" en este componente.` } : null;
    }
    case 'autocomplete-missing':
      return withAttr('autocomplete', inferAutocompleteToken(html));
    case 'color-contrast':
      return buildContrastSuggestion(finding, false);
    case 'color-contrast-enhanced':
      return buildContrastSuggestion(finding, true);
    default:
      return null;
  }
};

// ── Quick wins: mismos cálculos y fórmula que el reporte web ──
export interface QuickWinItem {
  id: string;
  nombre: string;
  nivel: string;
  elements: number;
  scoreAfter: number;
}

export interface QuickWinsSummary {
  currentScore: number;
  projectedScore: number;
  totalElements: number;
  remainingFailed: number;
  items: QuickWinItem[];
}

const isSpecificCriterion = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value.trim());

export const computeQuickWins = (scan: { urlResults?: Array<Record<string, any>> | null }): QuickWinsSummary | null => {
  const urlResult = (scan.urlResults ?? []).find(
    (ur) => Array.isArray(ur?.applicability?.criteria) && ur.applicability.criteria.length > 0,
  );
  if (!urlResult) return null;

  const criteria: Array<Record<string, any>> = urlResult.applicability.criteria;
  const applicable = criteria.filter((c) => c?.estado === 'aplica');
  if (applicable.length === 0) return null;

  const violations: Array<Record<string, any>> = Array.isArray(urlResult.violations) ? urlResult.violations : [];
  const elementsOf = (v: Record<string, any>) =>
    Array.isArray(v?.affectedElements) && v.affectedElements.length > 0 ? v.affectedElements.length : 1;

  const failedEffort = new Map<string, number>();
  const reviewCriteria = new Set<string>();
  for (const v of violations) {
    const criterion = isSpecificCriterion(v?.criterion) ? v.criterion.trim()
      : isSpecificCriterion(v?.wcagCriterion) ? v.wcagCriterion.trim() : null;
    if (!criterion) continue;
    const status = String(v?.findingStatus || v?.status || 'confirmed');
    if (status === 'confirmed') {
      failedEffort.set(criterion, (failedEffort.get(criterion) || 0) + elementsOf(v));
    } else if (status !== 'not_applicable') {
      reviewCriteria.add(criterion);
    }
  }

  const applicableIds = new Set(applicable.map((c) => String(c.id)));
  const failedRows = applicable.filter((c) => failedEffort.has(String(c.id)));
  if (failedRows.length === 0) return null;

  let reviewCount = 0;
  for (const id of reviewCriteria) {
    if (applicableIds.has(id) && !failedEffort.has(id)) reviewCount++;
  }

  const den = applicable.length;
  const passed = Math.max(0, den - failedRows.length - reviewCount);
  const scoreFor = (p: number) => Math.max(0, Math.min(100, Math.round((p / den) * 100)));
  const currentScore = scoreFor(passed);

  const ranked = [...failedRows].sort((a, b) => {
    const ea = failedEffort.get(String(a.id)) || 1;
    const eb = failedEffort.get(String(b.id)) || 1;
    return ea - eb || String(a.id).localeCompare(String(b.id));
  });

  const items: QuickWinItem[] = ranked.slice(0, 3).map((row, index) => ({
    id: String(row.id),
    nombre: String(row.nombre || ''),
    nivel: String(row.nivel || ''),
    elements: failedEffort.get(String(row.id)) || 1,
    scoreAfter: scoreFor(passed + index + 1),
  }));

  return {
    currentScore,
    projectedScore: items[items.length - 1].scoreAfter,
    totalElements: items.reduce((sum, item) => sum + item.elements, 0),
    remainingFailed: failedRows.length - items.length,
    items,
  };
};
