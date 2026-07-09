import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileText,
  Gauge,
  Lock,
  ListTree,
  TableProperties,
} from 'lucide-react';
import { API_BASE_URL } from '../config';

// Normaliza la URL de evidencia para que apunte siempre al API correcto.
// El endpoint /evidence/:key devuelve un redirect 302 a la presigned URL de R2,
// así el browser descarga directo desde Cloudflare R2, sin pasar por Railway.
function resolveEvidenceUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(/\/(?:api\/)?evidence\/(.+)$/);
    if (match) {
      return `${API_BASE_URL.replace(/\/+$/, '')}/evidence/${match[1]}`;
    }
  } catch {
    // fall through
  }
  return url;
}

function EvidencePreview({ url }: { url: string }) {
  const [error, setError] = useState(false);
  const evidenceUrl = resolveEvidenceUrl(url);

  if (error) {
    return <div className="report-no-evidence">Sin evidencia visual disponible</div>;
  }

  return (
    <a href={evidenceUrl} target="_blank" rel="noreferrer" className="report-evidence-link">
      <img
        src={evidenceUrl}
        alt="Evidencia visual"
        className="w-full rounded-lg border border-slate-200"
        onError={() => setError(true)}
      />
    </a>
  );
}
const getFindingReviewKey = (finding: any) =>
  [
    finding?.criterion || '',
    finding?.ruleId || '',
    finding?.selector || '',
    finding?.pageState || '',
  ].join('|');

// ═══════════════════════════════════════════════════════════════════════
// Generador de código corregido — transformaciones DETERMINÍSTICAS sobre el
// HTML real del hallazgo. Regla de honestidad: nunca inventa contenido; los
// valores que solo el dueño del sitio conoce van como placeholder [entre
// corchetes]. Corre en el navegador al renderizar: cero costo de servidor,
// retroactivo a todos los escaneos guardados.
// ═══════════════════════════════════════════════════════════════════════

// Inserta o reemplaza un atributo en la etiqueta de apertura del fragmento.
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

// ── Contraste: luminancia WCAG y búsqueda del color más cercano que cumple ──
const hexToRgb = (hex: string): [number, number, number] | null => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};

const rgbToHex = (rgb: [number, number, number]) =>
  '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

const relativeLuminance = ([r, g, b]: [number, number, number]) => {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (a: [number, number, number], b: [number, number, number]) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

const mixToward = (from: [number, number, number], to: [number, number, number], t: number): [number, number, number] =>
  [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * t) as [number, number, number];

// Devuelve el color de texto más cercano al original que alcanza el ratio.
const nearestCompliantColor = (fg: [number, number, number], bg: [number, number, number], target: number) => {
  const directions: Array<[number, number, number]> = [[0, 0, 0], [255, 255, 255]];
  let best: { hex: string; ratio: number; t: number } | null = null;
  for (const dir of directions) {
    let lo = 0;
    let hi = 1;
    if (contrastRatio(mixToward(fg, dir, 1), bg) < target) continue; // ni el extremo cumple
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

// Parsea los colores del mensaje de axe (español o inglés) y sugiere el ajuste.
const buildContrastSuggestion = (finding: any, enhanced: boolean) => {
  const message = String(finding?.elementFix || finding?.description || '');
  const hexes = message.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  const [fgHex, bgHex] = hexes;
  if (!fgHex || !bgHex) return null;
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const isLarge = /grande|large/i.test(message);
  const target = enhanced ? (isLarge ? 4.5 : 7) : (isLarge ? 3 : 4.5);
  const current = Math.round(contrastRatio(fg, bg) * 100) / 100;
  if (current >= target) return null;
  const fixed = nearestCompliantColor(fg, bg, target);
  if (!fixed) return null;
  return {
    code: `color: ${fixed.hex}; /* antes ${fgHex} — ratio ${fixed.ratio}:1 sobre ${bgHex} */`,
    note: `Color de texto más cercano al original que cumple ${target}:1. También puedes oscurecer/aclarar el fondo.`,
  };
};

// Infiere el token de autocomplete a partir de type/name del campo (determinístico).
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

// Snippet de <label> para campos sin etiqueta.
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

// ruleId normalizado → snippet corregido. Devuelve null si no hay transformación segura.
const buildCorrectedSnippet = (finding: any): { code: string; note?: string } | null => {
  const key = String(finding?.normalizedRuleId || finding?.ruleId || '').toLowerCase();
  const html = String(finding?.elementHtml || '').trim();
  const withAttr = (attr: string, value: string, note?: string) => {
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

function CopySnippetButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard no disponible */ }
  };
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 600, color: copied ? '#15803d' : '#2563eb',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Pasos de verificación manual por criterio WCAG — el "CÓMO comprobar" para
// desarrolladores sin experiencia en accesibilidad. Contenido estático:
// cero costo, retroactivo a todos los reportes.
// ═══════════════════════════════════════════════════════════════════════
const MANUAL_CHECK_STEPS: Record<string, string[]> = {
  '2.1.1': [
    'Haz clic en la barra de direcciones y presiona Tab para entrar a la página.',
    'Recorre TODOS los elementos interactivos solo con Tab (y Shift+Tab para retroceder).',
    'Activa botones con Enter o Espacio, y enlaces con Enter — sin usar el mouse.',
    'Si algún botón, menú o control no se alcanza o no se activa con teclado, es un incumplimiento.',
  ],
  '2.1.2': [
    'Navega con Tab hasta entrar al componente (modal, widget, reproductor).',
    'Intenta salir de él solo con Tab, Shift+Tab o Escape.',
    'Si el foco queda atrapado dando vueltas dentro y no puedes salir con teclado, es un incumplimiento.',
  ],
  '2.4.3': [
    'Presiona Tab repetidamente y observa el orden en que se mueve el foco.',
    'Compara ese orden con el orden visual de lectura (izquierda→derecha, arriba→abajo).',
    'Si el foco salta de forma ilógica (del menú al footer y de vuelta al header), es un incumplimiento.',
  ],
  '2.4.7': [
    'Presiona Tab por la página y observa cada elemento al recibir foco.',
    'Debe verse SIEMPRE un indicador visible (borde, contorno, cambio de fondo).',
    'Si en algún elemento no puedes distinguir dónde está el foco, es un incumplimiento.',
  ],
  '1.4.13': [
    'Pasa el mouse sobre el elemento que muestra contenido extra (tooltip, submenú).',
    'Mueve el puntero HACIA el contenido desplegado: no debe desaparecer antes de llegar.',
    'Presiona Escape con el contenido visible: debería poder cerrarse.',
    'Repite con teclado: al enfocar con Tab debe aparecer el mismo contenido.',
  ],
  '1.4.4': [
    'Presiona Ctrl y + hasta llegar a 200% de zoom.',
    'Verifica que todo el texto sigue legible y ningún contenido se corta o superpone.',
    'Si hay texto cortado, superpuesto o funcionalidad perdida al 200%, es un incumplimiento.',
  ],
  '1.4.10': [
    'Abre DevTools (F12) → modo responsive (Ctrl+Shift+M) → ancho 320px.',
    'Verifica que NO aparece scroll horizontal y el contenido se reacomoda en una columna.',
    'Si hay que desplazarse a los lados para leer, es un incumplimiento.',
  ],
  '1.2.2': [
    'Reproduce cada video de la página.',
    'Activa los subtítulos (botón CC) — deben existir y estar sincronizados.',
    'Los subtítulos automáticos de YouTube sin corregir NO cumplen: verifica nombres propios y términos técnicos.',
  ],
  '1.2.3': [
    'Reproduce el video sin mirar la pantalla (o con los ojos cerrados).',
    'Todo lo importante que se VE (textos en pantalla, acciones) ¿se entiende solo con el audio?',
    'Si no, se necesita audiodescripción o un documento alternativo equivalente.',
  ],
  '1.2.5': [
    'Reproduce el video sin mirar la pantalla.',
    'La información visual importante debe estar narrada en la pista de audio o en una audiodescripción.',
  ],
  '1.2.6': [
    'Revisa cada video pregrabado de la página.',
    'Verifica si incluye un recuadro con intérprete de Lengua de Señas Peruana (LSP).',
    'Para entidades públicas peruanas es exigible según la Res. 001-2025-PCM/SGTD y la Ley N° 29535.',
  ],
  '2.2.1': [
    'Identifica si hay límites de tiempo (cierre de sesión, formularios que expiran).',
    'Verifica que se pueda extender, desactivar o que avise antes de expirar con al menos 20 segundos para reaccionar.',
  ],
  '2.2.2': [
    'Localiza carruseles, animaciones o contenido que se mueve solo por más de 5 segundos.',
    'Debe existir un control visible para pausar, detener u ocultar ese movimiento.',
  ],
  '3.2.1': [
    'Navega con Tab por todos los controles SIN presionar Enter.',
    'Solo recibir foco no debe abrir ventanas, cambiar de página ni enviar formularios.',
  ],
  '3.2.2': [
    'Cambia valores en selects, checkboxes y radios sin presionar ningún botón.',
    'Solo cambiar el valor no debe navegar a otra página ni enviar el formulario automáticamente.',
  ],
  '4.1.3': [
    'Realiza una acción que muestre un mensaje (guardar, error de formulario, agregar al carrito).',
    'Inspecciona el mensaje en DevTools: debe tener role="status", role="alert" o aria-live.',
    'Sin eso, un lector de pantalla nunca anuncia el mensaje.',
  ],
  '2.5.7': [
    'Identifica funciones que requieren arrastrar (sliders, reordenar, mapas).',
    'Verifica que exista una alternativa de un solo clic/tap (botones +/-, flechas, campo numérico).',
  ],
  '1.3.1': [
    'Abre DevTools (F12) y revisa que los encabezados usen h1-h6 reales (no divs con estilo).',
    'Verifica que las listas usen ul/ol/li y las tablas de datos tengan th con scope.',
    'Usa el Mapa de Encabezados de este reporte para ver la jerarquía detectada.',
  ],
  '2.4.1': [
    'Carga la página y presiona Tab UNA vez.',
    'Debería aparecer un enlace "Saltar al contenido principal" visible.',
    'Actívalo con Enter: el foco debe ir al contenido, no quedarse en el menú.',
  ],
  '3.3.1': [
    'Envía el formulario con un campo obligatorio vacío o con datos inválidos.',
    'El error debe identificar QUÉ campo falló y describirse en texto (no solo borde rojo).',
    'Verifica con Tab que el foco pueda llegar al mensaje de error.',
  ],
  '3.3.3': [
    'Provoca un error de formato (ej. correo sin @).',
    'El mensaje debe SUGERIR la corrección ("Ingresa un correo como nombre@dominio.com"), no solo decir "inválido".',
  ],
};

const getVerificationSteps = (wcagRefs: string[] = []): { criterion: string; steps: string[] } | null => {
  for (const ref of wcagRefs) {
    const criterion = String(ref || '').trim();
    if (MANUAL_CHECK_STEPS[criterion]) return { criterion, steps: MANUAL_CHECK_STEPS[criterion] };
  }
  return null;
};

// "Por dónde empezar": victorias rápidas. La fórmula del score es
// passed/aplicables×100, así que cada criterio fallado vale lo mismo al
// resolverse — la priorización honesta es por ESFUERZO: los criterios con
// menos elementos afectados dan la misma subida de nota con menos trabajo.
const severityOrder: Record<string, number> = { critico: 4, alto: 3, medio: 2, bajo: 1 };

const getQuickWins = (rows: any[]) => {
  const applicable = rows.filter((row) => row.estado === 'aplica');
  if (applicable.length === 0) return null;

  const failedRows = applicable.filter((row) => row.uiStatus === 'falla');
  if (failedRows.length === 0) return null;

  const reviewCount = applicable.filter((row) => row.uiStatus === 'revision').length;
  const den = applicable.length;
  const passed = den - failedRows.length - reviewCount;
  const scoreFor = (passedCount: number) => Math.max(0, Math.round((passedCount / den) * 100));
  const currentScore = scoreFor(passed);

  const effortOf = (row: any) =>
    Number(row.affectedFindingCount) || row.confirmedFindings?.length || row.findings?.length || 1;
  const severityOf = (row: any) => {
    const raw = String(row.primaryFinding?.severity || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return severityOrder[raw] || 0;
  };

  const ranked = [...failedRows].sort((a, b) =>
    effortOf(a) - effortOf(b) || severityOf(b) - severityOf(a) || String(a.id).localeCompare(String(b.id)),
  );

  const top = ranked.slice(0, 3).map((row, index) => ({
    row,
    elements: effortOf(row),
    scoreAfter: scoreFor(passed + index + 1),
  }));

  return {
    currentScore,
    projectedScore: top[top.length - 1].scoreAfter,
    totalElements: top.reduce((sum, item) => sum + item.elements, 0),
    remainingFailed: failedRows.length - top.length,
    reviewCount,
    reviewPotential: reviewCount > 0 ? scoreFor(passed + top.length + reviewCount) : null,
    top,
  };
};

function QuickWinsPanel({ rows }: { rows: any[] }) {
  const wins = getQuickWins(rows);
  if (!wins) return null;
  const gain = wins.projectedScore - wins.currentScore;

  return (
    <section className="report-panel report-panel-spacious" aria-labelledby="quick-wins-title">
      <p className="report-kicker">Por dónde empezar</p>
      <h3 id="quick-wins-title" className="report-section-title">
        Victorias rápidas: de {wins.currentScore} a {wins.projectedScore} puntos
      </h3>
      <p style={{ fontSize: 14, color: '#475569', maxWidth: 640 }}>
        {wins.top.length === 1
          ? `Resolver este criterio (${wins.totalElements} ${wins.totalElements === 1 ? 'elemento' : 'elementos'})`
          : `Resolver estos ${wins.top.length} criterios — los de menor esfuerzo, ${wins.totalElements} ${wins.totalElements === 1 ? 'elemento afectado' : 'elementos afectados'} en total —`}
        {' '}sube tu cumplimiento <strong style={{ color: '#15803d' }}>+{gain} puntos</strong>.
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'grid', gap: 10 }}>
        {wins.top.map((item, index) => (
          <li
            key={item.row.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              padding: '0.85rem 1rem', borderRadius: 10,
              background: '#f8fafc', border: '1px solid #e2e8f0',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 14,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {index + 1}
            </span>
            <span style={{ flex: 1, minWidth: 220 }}>
              <strong style={{ color: '#0f172a', fontSize: 14 }}>{item.row.id} — {item.row.nombre}</strong>
              <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>
                Nivel {item.row.nivel} · {item.elements} {item.elements === 1 ? 'elemento afectado' : 'elementos afectados'}
              </span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>
              → {item.scoreAfter} pts
            </span>
          </li>
        ))}
      </ol>
      {(wins.remainingFailed > 0 || wins.reviewCount > 0) && (
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: '0.75rem' }}>
          {wins.remainingFailed > 0 && `Quedan ${wins.remainingFailed} criterios fallados adicionales en la matriz de abajo. `}
          {wins.reviewCount > 0 && wins.reviewPotential !== null &&
            `Verificar los ${wins.reviewCount} criterios en revisión manual podría llevarte hasta ${wins.reviewPotential} pts.`}
        </p>
      )}
    </section>
  );
}

const getWcagLevelDashboard = (rows: any[]) => {
  const levels = ['A', 'AA', 'AAA'];

  return levels.map((level) => {
    const levelRows = rows.filter((row) => row.nivel === level);
    const applicableRows = levelRows.filter((row) => row.estado === 'aplica');
    const passedRows = applicableRows.filter((row) => row.uiStatus === 'cumple');
    const failedRows = applicableRows.filter((row) => row.uiStatus === 'falla');
    const reviewRows = applicableRows.filter((row) => row.uiStatus === 'revision');
    const percent = applicableRows.length > 0
      ? Math.round((passedRows.length / applicableRows.length) * 100)
      : null;

    return {
      level,
      total: levelRows.length,
      applicable: applicableRows.length,
      passed: passedRows.length,
      failed: failedRows.length,
      review: reviewRows.length,
      percent,
    };
  });
};

function SemanticStructureViewer({ structure }: { structure: any }) {
  const [activeTab, setActiveTab] = useState<'headings' | 'outline'>('headings');
  const items = Array.isArray(structure?.items) ? structure.items : [];

  const getLevel = (item: any): number => {
    const l = item.level || parseInt(String(item.label || '1').replace(/[^0-9]/g, ''), 10);
    return Math.min(6, Math.max(1, l || 1));
  };

  const headingItems = items.filter((item: any) => {
    const label = String(item.label || '').toUpperCase();
    return item.kind === 'heading' && /^H[1-6]$/.test(label);
  });
  const landmarkItems = items.filter((item: any) => item.kind === 'landmark');

  const headingLevelCounts = headingItems.reduce((counts: Record<string, number>, item: any) => {
    const key = `H${getLevel(item)}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const headingWarnings = headingItems.filter((item: any) => item.status === 'warning').length;
  const headingErrors = headingItems.filter((item: any) => item.status === 'error').length;

  const isLastChild = (i: number): boolean => {
    const level = getLevel(headingItems[i]);
    for (let j = i + 1; j < headingItems.length; j++) {
      const jl = getLevel(headingItems[j]);
      if (jl < level) return true;
      if (jl === level) return false;
    }
    return true;
  };

  const hasGuideAt = (i: number, col: number): boolean => {
    const ancLevel = col + 1;
    for (let j = i + 1; j < headingItems.length; j++) {
      const jl = getLevel(headingItems[j]);
      if (jl < ancLevel) return false;
      if (jl === ancLevel) return true;
    }
    return false;
  };

  if (!structure || headingItems.length === 0) {
    return (
      <section id="estructura" className="report-panel report-panel-spacious semantic-structure-panel">
        <div className="focus-map-empty">
          <ListTree className="h-5 w-5" aria-hidden="true" />
          <div>
            <h3 className="report-section-title">Mapa de Encabezados</h3>
            <p>No se detectaron encabezados H1-H6 visibles para esta página.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="estructura" className="report-panel report-panel-spacious semantic-structure-panel">
      <div className="semantic-structure-header">
        <div>
          <p className="report-kicker">Estructura y orden de lectura</p>
          <h3 className="report-section-title">Mapa de Encabezados</h3>
          <p>Jerarquía visual de encabezados H1–H6 y landmarks semánticos de la página.</p>
        </div>
      </div>

      <div className="hmap-stats">
        <div className="hmap-stat"><span>Total</span><strong>{headingItems.length}</strong></div>
        {['H1','H2','H3','H4','H5','H6'].map((lv) => (
          <div key={lv} className={`hmap-stat hmap-stat-${lv.toLowerCase()}`}>
            <span>{lv}</span><strong>{headingLevelCounts[lv] ?? 0}</strong>
          </div>
        ))}
        <div className={`hmap-stat${headingWarnings > 0 ? ' hmap-stat-warn' : ''}`}>
          <span>Alertas</span><strong>{headingWarnings}</strong>
        </div>
        <div className={`hmap-stat${headingErrors > 0 ? ' hmap-stat-err' : ''}`}>
          <span>Errores</span><strong>{headingErrors}</strong>
        </div>
      </div>

      <div className="hmap-tabstrip" role="tablist" aria-label="Tipo de vista">
        <button role="tab" aria-selected={activeTab === 'headings'}
          className={`hmap-tab${activeTab === 'headings' ? ' hmap-tab-on' : ''}`}
          onClick={() => setActiveTab('headings')}>
          <ListTree className="h-4 w-4" aria-hidden="true" />
          Estructura de encabezados
          <em>{headingItems.length}</em>
        </button>
        <button role="tab" aria-selected={activeTab === 'outline'}
          className={`hmap-tab${activeTab === 'outline' ? ' hmap-tab-on' : ''}`}
          onClick={() => setActiveTab('outline')}>
          <TableProperties className="h-4 w-4" aria-hidden="true" />
          Esquema HTML5
          <em>{landmarkItems.length}</em>
        </button>
      </div>

      {activeTab === 'headings' && (
        <div className="hmap-tree" role="tabpanel">
          {headingItems.map((item: any, i: number) => {
            const level = getLevel(item);
            const text = (item.accessibleName || item.text || '').trim();
            const isEmpty = !text;
            const last = isLastChild(i);
            return (
              <div key={i} className={`hmap-node hmap-node-${item.status}`}>
                <div className="hmap-row">
                  <span className="hmap-tree-prefix" aria-hidden="true">
                    {Array.from({ length: level - 1 }).map((_, d) => (
                      <span key={d} className="hmap-tree-char">
                        {d === level - 2
                          ? (last ? '└' : '├')
                          : (hasGuideAt(i, d) ? '│' : '  ')}
                      </span>
                    ))}
                  </span>
                  <span className={`hmap-badge hmap-h${level}`}>H{level}</span>
                  <span className="hmap-seq">{i + 1}</span>
                  <span className={`hmap-htext${isEmpty ? ' hmap-htext-empty' : ''}${item.status === 'error' ? ' hmap-htext-error' : item.status === 'warning' ? ' hmap-htext-warn' : ''}`}>
                    {isEmpty ? '(sin texto accesible)' : text}
                  </span>
                  {item.status === 'error' && <span className="hmap-flag hmap-flag-err" title={item.issue}>✕</span>}
                  {item.status === 'warning' && <span className="hmap-flag hmap-flag-warn" title={item.issue}>⚠</span>}
                </div>
                {item.status !== 'ok' && (
                  <div className="hmap-node-issue">
                    <span className="hmap-node-msg">{item.issue}</span>
                    {item.suggestedFix && <span className="hmap-node-fix">{item.suggestedFix}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'outline' && (
        <div className="hmap-outline" role="tabpanel">
          {landmarkItems.length === 0 ? (
            <p className="hmap-outline-empty">No se detectaron landmarks semánticos (header, nav, main, aside, footer, section) en esta página.</p>
          ) : landmarkItems.map((item: any, i: number) => {
            const role = (item.role || item.label || 'region').toLowerCase().replace(/[^a-z0-9]/g, '');
            return (
              <div key={i} className={`hmap-landmark hmap-landmark-${item.status}`}>
                <span className={`hmap-lm-badge hmap-lm-${role}`}>{role.toUpperCase()}</span>
                <div className="hmap-lm-info">
                  <strong className="hmap-lm-name">{item.accessibleName || item.text || '(sin nombre accesible)'}</strong>
                  {item.status !== 'ok' && <span className="hmap-lm-issue">{item.issue}</span>}
                  <code className="hmap-lm-selector">{item.selector}</code>
                </div>
                {item.status === 'error' && <span className="hmap-flag hmap-flag-err">✕</span>}
                {item.status === 'warning' && <span className="hmap-flag hmap-flag-warn">⚠</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const getVisualMapEvidenceUrl = (visualMap: any, pageState?: string) => {
  const states = Array.isArray(visualMap?.states) ? visualMap.states : [];
  const matchingState = states.find((state: any) => state?.pageState === pageState && state?.screenshotUrl);
  return matchingState?.screenshotUrl || states.find((state: any) => state?.screenshotUrl)?.screenshotUrl || '';
};
const normalizeText = (value?: string) =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const severityRank: Record<string, number> = {
  critico: 4,
  alto: 3,
  medio: 2,
  bajo: 1,
};

const getSeverityRank = (severity?: string) => severityRank[normalizeText(severity)] || 0;

const getHighestSeverityFinding = (findings: any[]) =>
  [...(findings || [])].sort((a, b) => getSeverityRank(b?.severity) - getSeverityRank(a?.severity))[0] || null;

const getSeverityClass = (severity?: string) => {
  const normalized = normalizeText(severity);
  if (normalized === 'critico' || normalized === 'alto') return 'report-sev-high';
  if (normalized === 'medio') return 'report-sev-medium';
  return 'report-sev-low';
};

const getPageStateLabel = (finding: any) => {
  if (!finding) return '';
  if (finding.pageStateLabel) return finding.pageStateLabel;
  if (finding.pageState === 'initial') return 'Estado inicial';
  if (finding.pageState === 'post_overlay') return 'Después de cerrar modales';
  return 'Vista evaluada';
};

const getUniqueValues = (items: any[], mapper: (item: any) => string | undefined | null) =>
  Array.from(new Set((items || []).map(mapper).filter(Boolean))) as string[];

const splitReportText = (value?: string | null) =>
  String(value || '')
    .split(/\s*\|\s*/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const looksLikeCodeOrSelector = (value?: string | null) => {
  const text = String(value || '').trim();
  return /<[^>]+>|[#.][A-Za-z0-9_-]+|\b(?:aria-[\w-]+|role=|href=|class=|id=|data-[\w-]+|tabindex=)\b|[{};]/.test(text);
};

const getFindingDisplayDescription = (finding: any, fallback?: string) => {
  const rawDescription = splitReportText(finding?.description)[0];
  if (looksLikeCodeOrSelector(rawDescription)) return rawDescription;
  const cleanRaw = rawDescription
    ? rawDescription.replace(/^\[.*?\]\s*/, '').replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim()
    : '';
  return finding?.nameEs || cleanRaw || fallback || 'Hallazgo de accesibilidad';
};

const formatRepeatedTextSummary = (counts: Map<string, number>) =>
  Array.from(counts.entries())
    .map(([text, count]) => count > 1 ? `${text} (${count} elementos afectados)` : text)
    .join(' | ');

const getAffectedElementsCount = (finding: any) => {
  const selectors = Array.isArray(finding?.affectedElements) ? finding.affectedElements.filter(Boolean).length : 0;
  const samples = Array.isArray(finding?.affectedHtmlSamples) ? finding.affectedHtmlSamples.filter(Boolean).length : 0;
  return Math.max(1, selectors, samples);
};

const getFindingDescriptionSummary = (findings: any[] = [], manualVerifications: any[] = []) => {
  const counts = new Map<string, number>();

  for (const finding of findings || []) {
    const parts = splitReportText(getFindingDisplayDescription(finding));
    if (parts.length === 0) continue;

    const partCounts = new Map<string, number>();
    for (const part of parts) {
      partCounts.set(part, (partCounts.get(part) || 0) + 1);
    }

    const affectedCount = getAffectedElementsCount(finding);
    for (const [part, partCount] of partCounts.entries()) {
      const count = partCounts.size === 1 ? Math.max(partCount, affectedCount) : partCount;
      counts.set(part, (counts.get(part) || 0) + count);
    }
  }

  if (counts.size === 0) {
    for (const manual of manualVerifications || []) {
      for (const part of splitReportText(manual?.description)) {
        counts.set(part, (counts.get(part) || 0) + 1);
      }
    }
  }

  return formatRepeatedTextSummary(counts);
};

const getFindingCountLabel = (groupCount: number, affectedCount: number) => {
  if (affectedCount > groupCount) {
    return `${groupCount} grupos · ${affectedCount} elementos afectados`;
  }
  return `${groupCount} hallazgo${groupCount === 1 ? '' : 's'}`;
};

const getFindingGroupType = (finding: any) => {
  const status = String(finding?.findingStatus || finding?.status || '').toLowerCase();
  if (status === 'confirmed' || status === 'fail' || status === 'failed') return 'error';
  if (status === 'not_applicable' || status === 'pass' || status === 'passed') return 'validado';
  return 'revision';
};

const getFindingGroupBadge = (finding: any, count: number) => {
  const type = getFindingGroupType(finding);
  if (type === 'error') return `${count} error${count === 1 ? '' : 'es'}`;
  if (type === 'validado') return `${count} validado${count === 1 ? '' : 's'}`;
  return `${count} revisión${count === 1 ? '' : 'es'}`;
};

const getFindingStatusSummaryItems = (findings: any[] = []) => {
  const counts = { error: 0, revision: 0, validado: 0 };

  for (const finding of findings || []) {
    const type = getFindingGroupType(finding);
    counts[type as keyof typeof counts] += 1;
  }

  return [
    {
      key: 'error',
      count: counts.error,
      label: `${counts.error} confirmado${counts.error === 1 ? '' : 's'}`,
      className: 'report-status-failed',
    },
    {
      key: 'revision',
      count: counts.revision,
      label: `${counts.revision} en revisión`,
      className: 'report-status-pending',
    },
    {
      key: 'validado',
      count: counts.validado,
      label: `${counts.validado} validado${counts.validado === 1 ? '' : 's'}`,
      className: 'report-status-approved',
    },
  ].filter((item) => item.count > 0);
};

const getPrimaryFindingMessage = (finding: any, fallback?: string) => {
  const parts = splitReportText(finding?.description || finding?.nameEs || finding?.ruleId || fallback);
  return parts[0] || finding?.nameEs || finding?.ruleId || fallback || 'Hallazgo sin descripcion';
};

const stripFindingStatePrefix = (value: string) =>
  value.replace(/^\[[^\]]+\]\s*/g, '').replace(/\s*\(https?:\/\/[^\s)]+\)\s*/gi, '').trim();


// Mapa de ruleIds IBM Equal Access → título en español.
// Cubre los ~40 ruleIds más frecuentes que IBM genera y que no están en el
// diccionario del worker porque son específicos del motor IBM.
const IBM_RULE_TITLES: Record<string, string> = {
  aria_keyboard_handler_exists:        'Manejador de teclado faltante en elemento interactivo',
  aria_widget_labelled:                'Widget ARIA sin nombre accesible',
  aria_child_tabbable:                 'Elemento hijo no alcanzable por teclado',
  aria_hidden_nontabbable:             'Elemento oculto con acceso de teclado',
  aria_role_allowed_props:             'Propiedad ARIA no permitida para el rol',
  aria_semantics_role:                 'Rol ARIA semánticamente incorrecto',
  aria_semantics_attr_deprecated:      'Atributo ARIA obsoleto',
  aria_landmark_name_unique:           'Landmark ARIA con nombre duplicado',
  aria_main_label_visible:             'Región main sin etiqueta visible',
  aria_complementary_label_visible:    'Región complementaria sin etiqueta visible',
  aria_banner_label_visible:           'Banner sin etiqueta visible',
  aria_content_in_landmark:            'Contenido fuera de landmark semántico',
  aria_graphic_labelled:               'Gráfico ARIA sin nombre accesible',
  aria_eventhandler_role_valid:        'Manejador de evento en elemento sin rol válido',
  aria_attribute_conflict:             'Atributo ARIA en conflicto',
  aria_id_unique:                      'ID duplicado en elemento ARIA',
  rpt_elem_misuse:                     'Elemento HTML usado incorrectamente',
  rpt_elem_deprecated:                 'Elemento HTML obsoleto',
  rpt_elem_event_mouseevent:           'Evento de ratón sin alternativa de teclado',
  rpt_elem_lang_empty:                 'Idioma de página no definido',
  rpt_img_alt_null:                    'Imagen decorativa con texto alternativo innecesario',
  rpt_img_alt_valid:                   'Texto alternativo de imagen no descriptivo',
  rpt_label_unique:                    'Etiqueta de formulario duplicada',
  rpt_label_combobox_widget_exists:    'Combobox sin etiqueta accesible',
  rpt_form_ibm:                        'Formulario sin instrucciones accesibles',
  rpt_blink_csstextdecoration:         'Parpadeo de texto por CSS',
  rpt_media_audio_transcriptions:      'Audio sin transcripción',
  rpt_media_video_closed_caption:      'Video sin subtítulos',
  rpt_media_video_description:         'Video sin audiodescripción',
  rpt_table_layout_linearized:         'Tabla de maquetación no linealizable',
  rpt_table_headers_related:           'Encabezados de tabla no asociados a celdas',
  rpt_table_summary_exists:            'Tabla de datos sin resumen accesible',
  rpt_title_valid:                     'Título de página vacío o inválido',
  rpt_html_lang_valid:                 'Código de idioma no válido',
  wcag20_a_targetsize:                 'Área de interacción demasiado pequeña',
  wcag20_table_scope_valid:            'Atributo scope de tabla incorrecto',
  wcag20_input_label_exists:           'Campo de formulario sin etiqueta',
  wcag20_input_label_before:           'Etiqueta de campo ubicada después del control',
  wcag20_select_review_options:        'Opciones de lista sin etiqueta descriptiva',
  wcag20_img_alt_misuse:               'Uso incorrecto del atributo alt',
  identical_links_same_purpose:        'Enlaces idénticos con distinto destino',
};

// Convierte un ruleId_snake_case o ruleId-kebab-case en texto legible.
// Usado como último recurso cuando no hay mapeo explícito.
const ruleIdToReadable = (ruleId: string): string => {
  return ruleId
    .replace(/^(rpt_|aria_|wcag\d+_|ibm_)/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

const getFriendlyFindingTitle = (finding: any, fallback?: string) => {
  // 1. nameEs del worker/extensión tiene la máxima prioridad — ya está en español
  if (finding?.nameEs && !finding.nameEs.startsWith('Regla Automática')) {
    return finding.nameEs;
  }

  // 2. Mapa IBM por ruleId exacto
  const ruleIdRaw = String(finding?.ruleId || '').toLowerCase();
  if (ruleIdRaw && IBM_RULE_TITLES[ruleIdRaw]) {
    return IBM_RULE_TITLES[ruleIdRaw];
  }

  // 3. Inferencia desde texto combinado (descripción + ruleId)
  const rawMessage = stripFindingStatePrefix(getPrimaryFindingMessage(finding, fallback));
  const text = normalizeText([rawMessage, finding?.ruleId, finding?.nameEs, fallback].filter(Boolean).join(' '));

  if (text.includes('color contrast') || text.includes('contrast ratio') || text.includes('contraste')) return 'Contraste de color insuficiente';
  if (text.includes('form field') && text.includes('label')) return 'Campo de formulario sin etiqueta accesible';
  if (text.includes('no label for button') || (text.includes('button') && text.includes('programmatic name'))) return 'Botón sin nombre accesible';
  if (text.includes('input has no accessible name')) return 'Control sin nombre accesible';
  if (text.includes('accessible name') && text.includes('widget')) return 'Widget sin nombre accesible';
  if (text.includes('aria-labelledby') || text.includes('missing id') || text.includes('invalid aria')) return 'Referencia ARIA inválida';
  if (text.includes('required owned') || text.includes('listbox') || text.includes('option element')) return 'Widget ARIA incompleto';
  if (text.includes('content behind dialog') || text.includes('contenido detras') || text.includes('overlay visible')) return 'Contenido de fondo accesible detrás del diálogo';
  if (text.includes('dialog') && text.includes('accessible name')) return 'Diálogo sin nombre accesible';
  if (text.includes('scrollable') && (text.includes('keyboard') || text.includes('teclado'))) return 'Región desplazable no accesible por teclado';
  if (text.includes('keyboard') && text.includes('handler')) return 'Manejador de teclado faltante en elemento interactivo';
  if (text.includes('keyboard') && text.includes('event')) return 'Evento sin alternativa de teclado';
  if (text.includes('iframe') && text.includes('title')) return 'Iframe sin título descriptivo';
  if (text.includes('no link text') || text.includes('link has no text') || text.includes('enlace no tiene texto')) return 'Enlace sin texto accesible';
  if (text.includes('missing href') || text.includes('no tiene atributo href')) return 'Enlace sin destino href';
  if (text.includes('identical') && text.includes('link')) return 'Enlaces idénticos con distinto destino';
  if (text.includes('lang') && text.includes('html')) return 'Idioma de página no definido';
  if (text.includes('no nav landmark')) return 'Navegación principal sin landmark';
  if (text.includes('no main landmark')) return 'Contenido principal sin landmark';
  if (text.includes('bypass') || text.includes('skip to main')) return 'Falta enlace para saltar bloques repetidos';
  if (text.includes('empty list item')) return 'Elemento de lista vacío';
  if (text.includes('unknown table purpose')) return 'Propósito de tabla no identificado';
  if (text.includes('table') && text.includes('header')) return 'Encabezados de tabla no asociados';
  if (text.includes('image') || text.includes('img') || text.includes('non-text') || text.includes('no textual')) return 'Contenido no textual requiere revisión';
  if (text.includes('target size') || text.includes('tamano') || text.includes('area de interaccion')) return 'Área de interacción demasiado pequeña';
  if (text.includes('focus') && (text.includes('visible') || text.includes('indicador'))) return 'Indicador de foco no visible';
  if (text.includes('autocomplete')) return 'Autocompletado no definido en campo de datos';
  if (text.includes('duplicate') && text.includes('id')) return 'ID duplicado en la página';
  if (text.includes('label') && text.includes('empty')) return 'Etiqueta de control vacía';
  if (text.includes('title') && text.includes('page')) return 'Título de página no descriptivo';

  // 4. Último recurso: ruleId humanizado si es snake_case/kebab-case de IBM
  if (ruleIdRaw && (ruleIdRaw.includes('_') || ruleIdRaw.includes('-')) && ruleIdRaw.length > 5) {
    return ruleIdToReadable(finding.ruleId);
  }

  return fallback || rawMessage || 'Hallazgo por revisar';
};

const getFindingMessageGroups = (rows: any[] = []) => {
  const groupMap = new Map<string, any>();

  for (const row of rows || []) {
    const findings = Array.isArray(row?.findings) ? row.findings : [];

    for (const finding of findings) {
      const message = getPrimaryFindingMessage(finding, row?.nombre);
      const title = getFriendlyFindingTitle(finding, row?.nombre);
      const statusType = getFindingGroupType(finding);
      const wcagRef = String(finding?.wcagCriterion || finding?.criterion || row?.id || '').trim();
      const ruleId = String(finding?.ruleId || '').trim();
      // Clave: título amigable + criterio + statusType. El mismo problema detectado
      // por motores distintos (axe vs IBM, ruleIds diferentes) o en estados de
      // página distintos se fusiona en UNA fila — antes aparecían "duplicados"
      // (ej: dos filas "Evitar bloques (main landmark)"). Los ruleIds de cada
      // motor se conservan en group.rules y los elementos se deduplican en la
      // tabla técnica por selector+html.
      const key = [
        statusType,
        normalizeText(title),
        wcagRef.split(',')[0]?.trim() || '',
      ].join('|');

      const current = groupMap.get(key) || {
        key,
        message,
        title,
        statusType,
        findings: [],
        rows: new Map<string, any>(),
        wcagRefs: new Set<string>(),
        rules: new Set<string>(),
        views: new Set<string>(),
        roles: new Set<string>(),
        suggestions: new Set<string>(),
        descriptions: new Set<string>(),
        affectedElements: 0,
        highestSeverity: finding?.severity || 'medio',
      };

      current.findings.push(finding);
      current.title = title;
      current.rows.set(row?.id || row?.nombre || current.key, row);
      if (wcagRef) current.wcagRefs.add(wcagRef);
      if (ruleId) current.rules.add(ruleId);
      const view = getPageStateLabel(finding);
      if (view) current.views.add(view);
      if (finding?.role) current.roles.add(finding.role);
      if (finding?.suggestedFix) current.suggestions.add(finding.suggestedFix);
      for (const part of splitReportText(finding?.description || finding?.nameEs)) {
        current.descriptions.add(part);
      }
      current.affectedElements += getAffectedElementsCount(finding);
      if (getSeverityRank(finding?.severity) > getSeverityRank(current.highestSeverity)) {
        current.highestSeverity = finding?.severity || current.highestSeverity;
      }

      groupMap.set(key, current);
    }
  }

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      count: group.findings.length,
      criteriaCount: group.rows.size,
      wcagRefs: Array.from(group.wcagRefs),
      rules: Array.from(group.rules),
      views: Array.from(group.views),
      roles: Array.from(group.roles),
      suggestions: Array.from(group.suggestions),
      descriptions: Array.from(group.descriptions),
    }))
    .sort((a, b) => {
      const typeRank: Record<string, number> = { error: 3, revision: 2, validado: 1 };
      const rankDiff = (typeRank[b.statusType] || 0) - (typeRank[a.statusType] || 0);
      if (rankDiff !== 0) return rankDiff;
      const severityDiff = getSeverityRank(b.highestSeverity) - getSeverityRank(a.highestSeverity);
      if (severityDiff !== 0) return severityDiff;
      return b.affectedElements - a.affectedElements;
    })
    .map((group, _index, groups) => {
      // Contraste: 1.4.6 (AAA) siempre falla donde falla 1.4.3 (AA) — anotar que
      // los elementos se superponen para no inflar la percepción del problema.
      if (group.wcagRefs.includes('1.4.6') && groups.some((g) => g !== group && g.wcagRefs.includes('1.4.3'))) {
        return { ...group, contrastIncludesAA: true };
      }
      return group;
    })
    .sort((a, b) => {
      // El criterio AA legalmente exigible (1.4.3) va antes que su versión AAA
      // (1.4.6) cuando ambos aparecen con el mismo estado.
      if (a.statusType === b.statusType) {
        const aIs146 = a.wcagRefs.includes('1.4.6');
        const bIs143 = b.wcagRefs.includes('1.4.3');
        if (aIs146 && bIs143) return 1;
        if (a.wcagRefs.includes('1.4.3') && b.wcagRefs.includes('1.4.6')) return -1;
      }
      return 0;
    });
};

const getFindingMessageGroupLabel = (statusType: string, count: number) => {
  if (statusType === 'error') return `${count} error${count === 1 ? '' : 'es'}`;
  if (statusType === 'validado') return `${count} buena${count === 1 ? ' práctica' : 's prácticas'}`;
  return `${count} revisión${count === 1 ? '' : 'es'}`;
};

const getFindingMessageStatusLabel = (statusType: string) => {
  if (statusType === 'error') return 'Confirmado';
  if (statusType === 'validado') return 'Validado';
  return 'Requiere revisión';
};

const getFindingSourceLabel = (finding: any) => {
  const ruleId = String(finding?.ruleId || '').toLowerCase();
  if (ruleId.startsWith('htmlcs') || ruleId.includes('wcag2')) return 'HTML_CodeSniffer';
  if (ruleId.startsWith('pa11y')) return 'Pa11y';
  if (ruleId.startsWith('peru') || ruleId.includes('29973') || ruleId.includes('pcm')) return 'Regla peruana';
  if (ruleId.startsWith('manual')) return 'Revisión manual';
  if (ruleId) return 'Axe / motor automático';
  return 'Motor automático';
};

const getFindingImpact = (finding: any) => {
  const values = Array.isArray(finding?.disability) ? finding.disability.filter(Boolean) : [];
  return values.length > 0 ? values.join(', ') : 'Impacto por revisar';
};

// Extrae el texto visible de un fragmento HTML para mostrarlo junto al selector.
// Ejemplo: '<a href="/minedu">Inicio </a>' → 'Inicio'
const getVisibleTextFromHtml = (html: string): string => {
  if (!html) return '';
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
};

// Devuelve el nombre amigable de una regla a partir del finding.
// Prioriza nameEs del finding (ya mapeado por el diccionario), luego el ruleId.
const getFriendlyRuleName = (finding: any): string => {
  return finding?.nameEs || finding?.ruleId || 'Sin identificador';
};

interface ScanReportViewProps {
  currentScan: any;
  currentProject: any;
  selectedUrlResult: any;
  onBack: () => void;
  onUrlResultSelect: (result: any) => void;
  onExport: (kind: 'pdf-executive' | 'pdf-technical' | 'excel') => void;
  canUsePaidFeatures: boolean;
  renderScoreMeter: (score: number | null | undefined, label?: string, size?: 'compact' | 'large', showCaption?: boolean) => React.ReactNode;
  applicabilityRows: any[];
  filteredApplicabilityRows: any[];
  groupedApplicabilityRows: any[];
  applicabilitySummary: any;
  criterionViewMode: string;
  onCriterionViewModeChange: (mode: 'normal' | 'principles') => void;
  criterionLevelFilter: string;
  onCriterionLevelFilterChange: (value: string) => void;
  criterionApplicabilityFilter: string;
  onCriterionApplicabilityFilterChange: (value: string) => void;
  criterionResultFilter: string;
  onCriterionResultFilterChange: (value: string) => void;
  criterionSeverityFilter: string;
  onCriterionSeverityFilterChange: (value: string) => void;
  criterionRoleFilter: string;
  onCriterionRoleFilterChange: (value: string) => void;
  onApplicabilityUpdate: (criterionId: string, estado: 'aplica' | 'no_aplica') => void;
  updatingCriterionId: string | null;
  updatingFindingKey: string | null;
  expandedCriterionId: string | null;
  onToggleExpandedCriterion: (id: string | null) => void;
  onFindingStatusUpdate: (finding: any, status: 'confirmed' | 'needs_review' | 'not_applicable') => void;
  checklist86: string[];
  getApplicabilityStatusLabel: (status: string) => string;
  getApplicabilityStatusClass: (status: string) => string;
  getFindingStatusLabel: (finding: any) => string;
  getFindingStatusClass: (finding: any) => string;
  onViewPlans?: () => void;
}

export function ScanReportView({
  currentScan,
  currentProject,
  selectedUrlResult,
  onBack,
  onUrlResultSelect,
  onExport,
  canUsePaidFeatures,
  renderScoreMeter,
  applicabilityRows,
  filteredApplicabilityRows,
  groupedApplicabilityRows,
  applicabilitySummary,
  criterionViewMode,
  onCriterionViewModeChange,
  criterionLevelFilter,
  onCriterionLevelFilterChange,
  criterionApplicabilityFilter,
  onCriterionApplicabilityFilterChange,
  criterionResultFilter,
  onCriterionResultFilterChange,
  criterionSeverityFilter,
  onCriterionSeverityFilterChange,
  criterionRoleFilter,
  onCriterionRoleFilterChange,
  onApplicabilityUpdate,
  updatingCriterionId,
  updatingFindingKey,
  expandedCriterionId,
  onToggleExpandedCriterion,
  onFindingStatusUpdate,
  checklist86,
  getApplicabilityStatusLabel,
  getApplicabilityStatusClass,
  getFindingStatusLabel,
  getFindingStatusClass,
  onViewPlans,
}: ScanReportViewProps) {
  const wcagLevelDashboard = getWcagLevelDashboard(applicabilityRows);
  const findingMessageGroups = getFindingMessageGroups(applicabilityRows);
  const findingMessageTotals = findingMessageGroups.reduce(
    (totals, group) => {
      totals.groups += 1;
      totals.elements += group.affectedElements;
      if (group.statusType === 'error') totals.errors += group.count;
      if (group.statusType === 'revision') totals.reviews += group.count;
      if (group.statusType === 'validado') totals.validated += group.count;
      return totals;
    },
    { groups: 0, elements: 0, errors: 0, reviews: 0, validated: 0 }
  );

  const scrollToReportSection = (event: React.MouseEvent<HTMLAnchorElement>, anchor: string) => {
    event.preventDefault();
    const target = document.getElementById(anchor);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${anchor}`);
  };

  return (
    <div className="report-shell page-entrance">
      <aside className="report-sidebar">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Navegación Informe</div>
        {[
          { anchor: 'score', label: 'Score General', Icon: Gauge },
          { anchor: 'paginas', label: 'Página auditada', Icon: FileText },
          { anchor: 'estructura', label: 'Estructura semántica', Icon: ListTree },
          { anchor: 'criterios', label: 'Criterios y Hallazgos', Icon: TableProperties },
        ].map(({ anchor, label, Icon }) => (
          <a key={anchor} href={`#${anchor}`} className="report-side-link" onClick={(event) => scrollToReportSection(event, anchor)}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </a>
        ))}
      </aside>

      <div className="report-main-content report-section-stack">
        <section className="report-header-panel report-technical-header">
          <div className="report-technical-header-top">
            <div className="report-technical-title-row">
              <button onClick={onBack} className="report-ghost-btn report-back-btn" aria-label="Volver al proyecto">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="report-technical-title-copy">
                <p className="report-kicker">Informe técnico</p>
                <h2 className="report-title">Informe técnico: {currentProject?.name}</h2>
                <p className="report-subtitle">Auditoría realizada: {new Date(currentScan.createdAt).toLocaleString()}</p>
              </div>
            </div>
            {canUsePaidFeatures ? (
              <div className="report-export-actions">
                <button onClick={() => onExport('pdf-executive')} className="report-action-btn"><Download className="h-4 w-4" />PDF Ejecutivo</button>
                <button onClick={() => onExport('pdf-technical')} className="report-action-btn"><Download className="h-4 w-4" />PDF técnico</button>
                <button onClick={() => onExport('excel')} className="report-action-btn report-action-btn-green"><Download className="h-4 w-4" />Exportar Excel</button>
              </div>
            ) : (
              <div className="report-pro-lockout flex items-center justify-between gap-4">
                <span>Exportes y remediaciones están disponibles en Pro.</span>
                {onViewPlans && (
                  <button type="button" onClick={onViewPlans} className="report-action-btn report-action-btn-green shrink-0">
                    Ver opciones de pago
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="report-peru-badge">Resolución N.° 001-2025-PCM/SGTD · Estándar oficial Perú</div>
        </section>

        <section id="score" className="report-score-overview grid grid-cols-1 xl:grid-cols-5">
          <div className="xl:col-span-2 report-panel">
            <p className="report-kicker">Cumplimiento Global</p>
            {renderScoreMeter(currentScan.globalScore, 'Score técnico', 'large')}
          </div>

          <div className="xl:col-span-3 report-score-detail-grid grid">
            <div className="report-panel report-panel-spacious">
              <p className="report-kicker">Criterios de Verificación</p>
              <div className="grid md:grid-cols-3 gap-3 mt-3">
                <div><p className="text-xs text-slate-500">Total de criterios</p><p className="text-xl font-bold text-slate-900">{applicabilitySummary?.totalCriteria ?? 86}</p></div>
                <div><p className="text-xs text-slate-500">Aplican al sitio</p><p className="text-xl font-bold text-slate-900">{applicabilitySummary?.applicableCount ?? '-'}</p></div>
                <div><p className="text-xs text-slate-500">Página auditada</p><p className="text-xl font-bold text-slate-900">{currentScan.urlResults?.length || 0}</p></div>
              </div>
                    <details className="mt-4 report-checklist">
                      <summary>Ver checklist de 86 criterios</summary>
                <div className="report-checklist-grid">
                  {(applicabilityRows.length > 0 ? applicabilityRows.map((row) => `${row.id} - ${row.nombre}`) : checklist86).map((item) => (
                    <span key={item} className="report-check-item">{item}</span>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="report-panel report-panel-spacious wcag-level-dashboard" aria-labelledby="wcag-level-dashboard-title">
          <div className="wcag-level-dashboard-header">
            <div>
              <p className="report-kicker">Cumplimiento por nivel</p>
              <h3 id="wcag-level-dashboard-title" className="report-section-title">Resultado WCAG A, AA y AAA</h3>
              <p>Porcentaje calculado sobre los criterios aplicables de cada nivel.</p>
            </div>
            <span>{applicabilitySummary?.applicableCount ?? 0} criterios aplicables</span>
          </div>
          <div className="wcag-level-grid">
            {wcagLevelDashboard.map((item) => (
              <article key={item.level} className="wcag-level-card">
                <div className="wcag-level-card-head">
                  <span>Nivel {item.level}</span>
                  <strong>{item.percent === null ? 'N/A' : `${item.percent}%`}</strong>
                </div>
                <div
                  className="wcag-level-meter"
                  role="meter"
                  aria-label={`Cumplimiento WCAG nivel ${item.level}: ${item.percent === null ? 'no aplica' : `${item.percent} por ciento`}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.percent ?? 0}
                >
                  <div style={{ width: `${item.percent ?? 0}%` }} />
                </div>
                <div className="wcag-level-stats">
                  <span><strong>{item.passed}</strong> cumplen</span>
                  <span><strong>{item.failed}</strong> fallan</span>
                  <span><strong>{item.review}</strong> revisión</span>
                </div>
                <p>{item.applicable} aplican de {item.total} criterios del nivel.</p>
              </article>
            ))}
          </div>
        </section>

        <QuickWinsPanel rows={applicabilityRows} />

        <section className="report-panel report-panel-spacious finding-message-dashboard" aria-labelledby="finding-message-dashboard-title">
          <div className="finding-message-dashboard-header">
            <div>
              <p className="report-kicker">Resumen técnico</p>
              <h3 id="finding-message-dashboard-title" className="report-section-title">Resultados agrupados por problema</h3>
              <p>Abre cada problema para ver elementos afectados, evidencia, criterio WCAG y solución sugerida. La matriz legal completa se mantiene debajo.</p>
            </div>
            <div className="finding-message-totals">
              <span><strong>{findingMessageTotals.errors}</strong> errores</span>
              <span><strong>{findingMessageTotals.reviews}</strong> revisiones</span>
              <span><strong>{findingMessageTotals.elements}</strong> elementos</span>
            </div>
          </div>
          {!canUsePaidFeatures ? (
            <div className="report-pro-lockout-large relative p-8 text-center bg-slate-50 border border-slate-200 rounded-lg mt-6">
              <Lock className="mx-auto h-8 w-8 text-slate-400 mb-3" />
              <h4 className="text-lg font-medium text-slate-900 mb-2">Agrupación inteligente disponible en Pro</h4>
              <p className="text-slate-600 mb-4 max-w-md mx-auto">
                La agrupación de problemas, el análisis de impacto técnico y la inspección de código afectado son funciones exclusivas de cuentas Pro.
              </p>
              {onViewPlans && (
                <button type="button" onClick={onViewPlans} className="report-action-btn report-action-btn-green mx-auto">
                  Ver opciones de pago
                </button>
              )}
            </div>
          ) : findingMessageGroups.length === 0 ? (
            <div className="finding-message-empty">
              No hay hallazgos activos para agrupar. Revisa la matriz WCAG para validar criterios cumplidos y no aplicables.
            </div>
          ) : (
            <div className="finding-message-list">
              {findingMessageGroups.map((group) => {
                const wcagText = group.wcagRefs.length > 0 ? group.wcagRefs.join(', ') : 'WCAG por validar';
                const suggestion = group.suggestions[0] || 'Revisar el contexto del componente y aplicar la corrección WCAG correspondiente.';
                const MAX_ELEMENTS = 20;
                return (
                  <details
                    key={group.key}
                    className={`finding-message-group finding-message-group-${group.statusType}`}
                  >
                    <summary>
                      <span className={`finding-message-count finding-message-count-${group.statusType}`}>
                        {getFindingMessageGroupLabel(group.statusType, group.count)}
                      </span>
                      <span className="finding-message-summary-copy">
                        <strong>{group.title}</strong>
                        <small>
                          {getFindingMessageStatusLabel(group.statusType)} · {group.affectedElements} elemento{group.affectedElements === 1 ? '' : 's'} afectado{group.affectedElements === 1 ? '' : 's'} · Criterio {wcagText}
                          {group.contrastIncludesAA ? ' · Incluye los elementos que ya fallan el criterio 1.4.3 (AA)' : ''}
                        </small>
                      </span>
                      <span className={`finding-message-severity ${getSeverityClass(group.highestSeverity)}`}>{group.highestSeverity || 'medio'}</span>
                    </summary>

                    <div className="finding-message-body">

                      {/* Zona superior: legible por cualquier persona */}
                      <div className="finding-plain-block">
                        <div className="finding-plain-icon" aria-hidden="true">👤</div>
                        <div className="finding-plain-content">
                          <p className="finding-plain-label">¿Qué significa y cómo corregirlo?</p>
                          <p className="finding-plain-text">{canUsePaidFeatures ? suggestion : 'Disponible en Pro'}</p>
                          {group.statusType === 'revision' && (() => {
                            const verification = getVerificationSteps(group.wcagRefs);
                            if (!verification) return null;
                            return (
                              <div style={{ marginTop: '0.6rem' }}>
                                <p className="finding-plain-label" style={{ marginBottom: 4 }}>Cómo verificarlo paso a paso</p>
                                <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: 13, color: '#475569', display: 'grid', gap: 3 }}>
                                  {verification.steps.map((step, stepIndex) => (
                                    <li key={stepIndex}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            );
                          })()}
                          <div className="finding-plain-meta">
                            <span><strong>Criterio:</strong> {wcagText}</span>
                            <span><strong>Quién lo corrige:</strong> {group.roles.length > 0 ? group.roles.join(', ') : 'Equipo técnico'}</span>
                            <span><strong>Vistas:</strong> {group.views.length > 0 ? group.views.join(', ') : 'Vista principal'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Zona inferior: detalles técnicos colapsados */}
                      <details className="finding-technical-block">
                        <summary className="finding-technical-toggle">
                          Ver código y ubicación exacta — para desarrolladores
                        </summary>
                        <div className="finding-technical-content">
                          <p className="finding-technical-hint">
                            Usa el selector CSS para encontrar el elemento en DevTools (F12 → Elementos → Ctrl+F).
                          </p>
                          <div className="finding-element-table">
                            <div className="finding-element-table-head">
                              <span>#</span>
                              <span>Selector CSS</span>
                              <span>Fragmento HTML afectado</span>
                              <span>Corrección específica del elemento</span>
                            </div>
                            {(() => {
                              // Deduplicar por selector+html: si el mismo elemento aparece
                              // en varios viewports/estados, mostrarlo una vez y anotar
                              // en qué contextos ocurre (Desktop, Tablet, Móvil, etc.)
                              const seen = new Map<string, { finding: any; contexts: string[] }>();
                              for (const finding of group.findings) {
                                const dedupeKey = `${finding?.selector || ''}||${(finding?.elementHtml || '').slice(0, 120)}`;
                                const ctx = finding?.pageStateLabel || finding?.pageState || '';
                                if (seen.has(dedupeKey)) {
                                  const entry = seen.get(dedupeKey)!;
                                  if (ctx && !entry.contexts.includes(ctx)) entry.contexts.push(ctx);
                                } else {
                                  seen.set(dedupeKey, { finding, contexts: ctx ? [ctx] : [] });
                                }
                              }
                              const dedupedFindings = Array.from(seen.values()).slice(0, MAX_ELEMENTS);
                              const hiddenCount = seen.size - dedupedFindings.length;
                              return (
                                <>
                                  {dedupedFindings.map(({ finding, contexts }, findingIndex) => {
                                    const selector = finding?.selector || 'Sin selector';
                                    const html = finding?.elementHtml || '';
                                    const elementFix = finding?.fixScope === 'page'
                                      ? 'Se resuelve con una corrección única a nivel de página (ver la solución sugerida del grupo).'
                                      : (finding?.elementFix || finding?.suggestedFix || suggestion);
                                    const visibleText = getVisibleTextFromHtml(html);
                                    return (
                                      <div key={`${group.key}-el-${findingIndex}`} className="finding-element-row">
                                        <span className="finding-element-num">{findingIndex + 1}</span>
                                        <div className="finding-element-selector-cell">
                                          <code className="finding-element-selector">{selector}</code>
                                          {visibleText && <em className="finding-element-visible-text">"{visibleText}"</em>}
                                          {contexts.length > 0 && (
                                            <div className="finding-element-contexts">
                                              {contexts.map((ctx) => (
                                                <span key={ctx} className="finding-element-ctx-tag">{ctx}</span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <pre className="finding-element-html"><code>{html || '(sin fragmento HTML)'}</code></pre>
                                        <div>
                                          <p className="finding-element-fix">{canUsePaidFeatures ? elementFix : 'Disponible en Pro'}</p>
                                          {canUsePaidFeatures && (() => {
                                            const corrected = buildCorrectedSnippet(finding);
                                            if (!corrected) return null;
                                            return (
                                              <div style={{ marginTop: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Código sugerido</span>
                                                  <CopySnippetButton code={corrected.code} />
                                                </div>
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.5, color: '#14532d' }}><code>{corrected.code}</code></pre>
                                                {corrected.note && (
                                                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4d7c0f' }}>{corrected.note}</p>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {hiddenCount > 0 && (
                                    <p className="finding-message-more">+{hiddenCount} elementos adicionales con el mismo problema.</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </details>

                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        {selectedUrlResult && <SemanticStructureViewer structure={selectedUrlResult.semanticStructure} />}

        {selectedUrlResult?.peruvianChecks && Array.isArray(selectedUrlResult.peruvianChecks) && selectedUrlResult.peruvianChecks.length > 0 && (
          <section id="normativa-peruana" className="report-panel report-panel-spacious">
            <h3 className="report-section-title">Normativa Peruana — Res. 001-2025-PCM/SGTD</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">Verificaciones específicas de accesibilidad para la Administración Pública del Perú según la Ley N° 29973 y la Resolución de Presidencia del Consejo de Ministros.</p>
            <div className="flex flex-col gap-3">
              {selectedUrlResult.peruvianChecks.map((check: any, idx: number) => {
                const statusColors: Record<string, string> = {
                  pass: 'bg-green-50 border-green-200 text-green-800',
                  fail: 'bg-red-50 border-red-200 text-red-800',
                  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                  manual_review: 'bg-blue-50 border-blue-200 text-blue-800',
                };
                const statusLabels: Record<string, string> = {
                  pass: 'Cumple',
                  fail: 'Incumple',
                  warning: 'Advertencia',
                  manual_review: 'Revisión manual',
                };
                const colorClass = statusColors[check.status] || statusColors.warning;
                return (
                  <div key={`peru-${idx}`} className={`rounded-lg border p-4 ${colorClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{check.name}</p>
                        <p className="text-xs mt-0.5 opacity-70">Criterio {check.criterion}</p>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/60 border border-current/20">{statusLabels[check.status] || check.status}</span>
                    </div>
                    <p className="text-sm mt-2">{check.description}</p>
                    {check.details && <p className="text-xs mt-1 opacity-80">{check.details}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section id="paginas" className="report-panel report-panel-spacious">
          <div className="flex items-center justify-between mb-3">
            <h3 className="report-section-title">Página auditada</h3>
          </div>
          <div className="report-audited-page-grid grid gap-3">
            {currentScan.urlResults?.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-400 text-sm">No hay páginas auditadas</div>
            ) : currentScan.urlResults?.map((ur: any) => (
              <button key={ur.id} onClick={() => onUrlResultSelect(ur)} className={`report-url-card ${selectedUrlResult?.id === ur.id ? 'report-url-card-active' : ''}`}>
                <p className="font-mono text-xs text-slate-500 truncate text-left">{ur.url}</p>
                <div className="mt-3 flex text-xs">
                  <span className="report-chip">Score {ur.score}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {selectedUrlResult && (
          <>
            <section id="criterios" className="report-panel report-panel-spacious">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="report-section-title">Criterios WCAG y Hallazgos</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {applicabilitySummary
                      ? `Aplican ${applicabilitySummary.applicableCount} de ${applicabilitySummary.totalCriteria} criterios a este sitio. Cumple ${applicabilitySummary.passedCount}. Requiere revisión ${applicabilitySummary.reviewCount ?? 0}.`
                      : 'Sin matriz de aplicabilidad para este resultado.'}
                  </p>
                </div>
                <label className="report-view-mode-control">
                  <span>Vista</span>
                  <select
                    autoComplete="off"
                    className="report-table-filter"
                    value={criterionViewMode}
                    onChange={e => onCriterionViewModeChange(e.target.value as 'normal' | 'principles')}
                  >
                    <option value="normal">Orden normal</option>
                    <option value="principles">Por principios</option>
                  </select>
                </label>
              </div>

              <div className="report-applicability-summary-row">
                <div className="report-applicability-card">
                  <span>Total</span>
                  <strong>{applicabilitySummary?.totalCriteria ?? 86}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>Aplican</span>
                  <strong>{applicabilitySummary?.applicableCount ?? 0}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>Cumplen</span>
                  <strong>{applicabilitySummary?.passedCount ?? 0}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>Fallan</span>
                  <strong>{applicabilitySummary?.failedCount ?? 0}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>Revisión</span>
                  <strong>{applicabilitySummary?.reviewCount ?? 0}</strong>
                </div>
                <div className="report-applicability-card">
                  <span>No aplican</span>
                  <strong>{applicabilitySummary?.notApplicableCount ?? 0}</strong>
                </div>
              </div>

              <div className="report-filter-stack">
                <label>
                  <span>Nivel WCAG</span>
                  <select aria-label="Filtrar por nivel WCAG" autoComplete="off" className="report-table-filter" value={criterionLevelFilter} onChange={e => onCriterionLevelFilterChange(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="A">A</option>
                    <option value="AA">AA</option>
                    <option value="AAA">AAA</option>
                  </select>
                </label>
                <label>
                  <span>Aplicabilidad</span>
                  {canUsePaidFeatures ? (
                    <select aria-label="Filtrar por aplicabilidad" autoComplete="off" className="report-table-filter" value={criterionApplicabilityFilter} onChange={e => onCriterionApplicabilityFilterChange(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="aplica">Aplica</option>
                      <option value="no_aplica">No aplica</option>
                    </select>
                  ) : (
                    <button type="button" onClick={onViewPlans} className="report-pro-locked-pill cursor-pointer hover:bg-slate-200">Plan Pro</button>
                  )}
                </label>
                <label>
                  <span>Resultado</span>
                  {canUsePaidFeatures ? (
                    <select aria-label="Filtrar por resultado" autoComplete="off" className="report-table-filter" value={criterionResultFilter} onChange={e => onCriterionResultFilterChange(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="cumple">Cumple</option>
                      <option value="falla">Falla</option>
                      <option value="revision">Requiere revisión</option>
                      <option value="na">N/A</option>
                    </select>
                  ) : (
                    <button type="button" onClick={onViewPlans} className="report-pro-locked-pill cursor-pointer hover:bg-slate-200">Plan Pro</button>
                  )}
                </label>
                <label>
                  <span>Severidad</span>
                  <select aria-label="Filtrar por severidad" autoComplete="off" className="report-table-filter" value={criterionSeverityFilter} onChange={e => onCriterionSeverityFilterChange(e.target.value)}>
                    <option value="todos">Todas</option>
                    <option value="critico">Crítico</option>
                    <option value="alto">Alto</option>
                    <option value="medio">Medio</option>
                    <option value="bajo">Bajo</option>
                  </select>
                </label>
                <label>
                  <span>Rol</span>
                  <select aria-label="Filtrar por rol" autoComplete="off" className="report-table-filter" value={criterionRoleFilter} onChange={e => onCriterionRoleFilterChange(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="Desarrollador">Desarrollador</option>
                    <option value="Diseñador UX/UI">Diseñador UX/UI</option>
                    <option value="Redactor UX">Redactor UX</option>
                    <option value="Compartido">Compartido</option>
                  </select>
                </label>
              </div>

              <div className="report-table-scroll overflow-x-auto">
                <table className="w-full report-table report-table-spacious" aria-label="Tabla unificada de criterios WCAG y hallazgos">
                  <thead>
                    <tr>
                      <th scope="col">Criterio</th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Nivel WCAG</span>
                          <select aria-label="Filtrar por nivel WCAG" autoComplete="off" className="report-table-filter" value={criterionLevelFilter} onChange={e => onCriterionLevelFilterChange(e.target.value)}>
                            <option value="todos">Todos</option>
                            <option value="A">A</option>
                            <option value="AA">AA</option>
                            <option value="AAA">AAA</option>
                          </select>
                        </div>
                      </th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Aplicabilidad</span>
                          {canUsePaidFeatures ? (
                            <select aria-label="Filtrar por aplicabilidad" autoComplete="off" className="report-table-filter" value={criterionApplicabilityFilter} onChange={e => onCriterionApplicabilityFilterChange(e.target.value)}>
                              <option value="todos">Todos</option>
                              <option value="aplica">Aplica</option>
                              <option value="no_aplica">No aplica</option>
                            </select>
                          ) : (
                            <span className="report-pro-locked-pill">Plan Pro</span>
                          )}
                        </div>
                      </th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Resultado</span>
                          {canUsePaidFeatures ? (
                            <select aria-label="Filtrar por resultado" autoComplete="off" className="report-table-filter" value={criterionResultFilter} onChange={e => onCriterionResultFilterChange(e.target.value)}>
                              <option value="todos">Todos</option>
                              <option value="cumple">Cumple</option>
                              <option value="falla">Falla</option>
                              <option value="revision">Requiere revisión</option>
                              <option value="na">N/A</option>
                            </select>
                          ) : (
                            <span className="report-pro-locked-pill">Plan Pro</span>
                          )}
                        </div>
                      </th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Motivo de Aplicabilidad</th>
                      <th scope="col">Hallazgos</th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Severidad</span>
                          <select aria-label="Filtrar por severidad" autoComplete="off" className="report-table-filter" value={criterionSeverityFilter} onChange={e => onCriterionSeverityFilterChange(e.target.value)}>
                            <option value="todos">Todas</option>
                            <option value="critico">Crítico</option>
                            <option value="alto">Alto</option>
                            <option value="medio">Medio</option>
                            <option value="bajo">Bajo</option>
                          </select>
                        </div>
                      </th>
                      <th scope="col">Estado hallazgo</th>
                      <th scope="col">Descripción</th>
                      <th scope="col">
                        <div className="report-table-header-cell">
                          <span className="report-table-filter-label">Rol</span>
                          <select aria-label="Filtrar por rol" autoComplete="off" className="report-table-filter" value={criterionRoleFilter} onChange={e => onCriterionRoleFilterChange(e.target.value)}>
                            <option value="todos">Todos</option>
                            <option value="Desarrollador">Desarrollador</option>
                            <option value="Diseñador UX/UI">Diseñador UX/UI</option>
                            <option value="Redactor UX">Redactor UX</option>
                            <option value="Compartido">Compartido</option>
                          </select>
                        </div>
                      </th>
                      <th scope="col">Solución sugerida</th>
                      <th scope="col">Evidencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplicabilityRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="text-center text-slate-500">No hay criterios para el filtro seleccionado.</td>
                      </tr>
                    ) : groupedApplicabilityRows.map((item) => {
                      if (item.kind === 'principle') {
                        return (
                          <tr key={`principle-${item.key}`} className="report-principle-row">
                            <td colSpan={13}>
                              <div className="report-principle-row-content">
                                <strong>{item.key === 'otros' ? item.title : `${item.key}. ${item.title}`}</strong>
                                <span>{item.description}</span>
                                <em>{item.count} criterio(s)</em>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      if (item.kind === 'guideline') {
                        return (
                          <tr key={`guideline-${item.key}`} className="report-guideline-row">
                            <td colSpan={13}>
                              <div className="report-guideline-row-content">
                                <strong>{item.key === 'otros' ? item.title : `Pauta ${item.key}. ${item.title}`}</strong>
                                <span>{item.description}</span>
                                <em>{item.count} criterio(s)</em>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      const row = item.row;
                      const finding = getHighestSeverityFinding(row.findings) || row.primaryFinding;
                      const findingCount = row.findings?.length || 0;
                      const affectedFindingCount = row.affectedFindingCount || findingCount;
                      const statusSummaryItems = getFindingStatusSummaryItems(row.findings);
                      const roleSummary = getUniqueValues(row.findings, (findingItem) => findingItem.role);
                      const descriptionSummary = getFindingDescriptionSummary(row.findings, row.manualVerifications);
                      const hasMultipleFindings = findingCount > 1;
                      return (
                        <React.Fragment key={item.key}>
                          <tr className="report-row-hover">
                            <td>{row.id}</td>
                            <td>{row.nivel}</td>
                            <td>
                              {canUsePaidFeatures ? (
                                <select
                                  aria-label={`Editar aplicabilidad del criterio ${row.id}`}
                                  autoComplete="off"
                                  className="report-table-filter report-applicability-edit"
                                  value={row.estado}
                                  disabled={updatingCriterionId === row.id}
                                  onChange={e => onApplicabilityUpdate(row.id, e.target.value as 'aplica' | 'no_aplica')}
                                >
                                  <option value="aplica">Aplica</option>
                                  <option value="no_aplica">No aplica</option>
                                </select>
                              ) : (
                                <span className="report-pro-locked-pill">Disponible en Pro</span>
                              )}
                            </td>
                            <td>
                              {canUsePaidFeatures
                                ? (row.estado === 'no_aplica' ? '' : <span className={`report-status-badge ${getApplicabilityStatusClass(row.uiStatus)}`}>{getApplicabilityStatusLabel(row.uiStatus)}</span>)
                                : <span className="report-pro-locked-pill">Disponible en Pro</span>}
                            </td>
                            <td>{row.nombre}</td>
                            <td>{canUsePaidFeatures ? row.razon : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>
                              {!canUsePaidFeatures ? (
                                <span className="report-pro-locked-pill">Disponible en Pro</span>
                              ) : row.estado === 'aplica' && findingCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => onToggleExpandedCriterion(expandedCriterionId === row.id ? null : row.id)}
                                  className="report-finding-count-btn"
                                >
                                  {getFindingCountLabel(findingCount, affectedFindingCount)}
                                </button>
                              ) : ''}
                            </td>
                            <td>{canUsePaidFeatures ? (finding ? <span className={`report-severity-chip ${getSeverityClass(finding.severity)}`}>{finding.severity}</span> : '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>{canUsePaidFeatures ? (finding ? (
                              <div className="report-inline-stack">
                                {hasMultipleFindings ? (
                                  statusSummaryItems.map((status) => (
                                    <span key={status.key} className={`report-status-badge ${status.className}`}>{status.label}</span>
                                  ))
                                ) : (
                                  <span className={`report-status-badge ${getFindingStatusClass(finding)}`}>{getFindingStatusLabel(finding)}</span>
                                )}
                              </div>
                            ) : '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>{canUsePaidFeatures ? (findingCount > 0 ? descriptionSummary : '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>{canUsePaidFeatures ? (roleSummary.length > 0 ? roleSummary.join(', ') : finding?.role || '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>{canUsePaidFeatures ? (finding?.suggestedFix || '') : <span className="report-pro-locked-pill">Disponible en Pro</span>}</td>
                            <td>
                              {canUsePaidFeatures && findingCount > 0 ? (
                                <button onClick={() => onToggleExpandedCriterion(expandedCriterionId === row.id ? null : row.id)} className="report-evidence-btn">
                                  {expandedCriterionId === row.id ? 'Ocultar' : 'Ver detalle'}
                                </button>
                              ) : !canUsePaidFeatures ? (
                                <span className="report-pro-locked-pill">Disponible en Pro</span>
                              ) : ''}
                            </td>
                          </tr>
                          {canUsePaidFeatures && expandedCriterionId === row.id && findingCount > 0 && (
                            <tr>
                              <td colSpan={13} className="report-evidence-cell">
                                <div className="report-finding-detail-list">
                                  <div className="report-finding-group-summary">
                                    <strong>{getFindingCountLabel(findingCount, affectedFindingCount)}</strong>
                                    <span>Los grupos unen problemas iguales por regla, vista y criterio. Los elementos afectados aparecen dentro de cada grupo.</span>
                                  </div>
                                  {row.findings.map((item: any, itemIndex: number) => {
                                    const affectedSelectors = Array.isArray(item.affectedElements) ? item.affectedElements.filter(Boolean) : [];
                                    const affectedSamples = Array.isArray(item.affectedHtmlSamples) ? item.affectedHtmlSamples.filter(Boolean) : [];
                                    const occurrenceItems = affectedSelectors.length > 0 ? affectedSelectors : affectedSamples;
                                    const occurrenceCount = getAffectedElementsCount(item);
                                    const groupType = getFindingGroupType(item);
                                    const evidenceUrl = item.screenshotUrl || getVisualMapEvidenceUrl(selectedUrlResult?.visualMap, item.pageState);
                                    return (
                                      <details key={`${row.id}-${itemIndex}`} className={`report-finding-group report-finding-group-${groupType}`} open={itemIndex === 0}>
                                        <summary>
                                          <span className={`report-finding-group-count report-finding-group-count-${groupType}`}>
                                            {getFindingGroupBadge(item, occurrenceCount)}
                                          </span>
                                          <span className="report-finding-group-title">
                                            <strong>
                                              {getFindingDescriptionSummary([item]) || item.nameEs || row.nombre}
                                              {(item.pageStateLabels?.length > 1 ? item.pageStateLabels : item.pageStateLabel ? [item.pageStateLabel] : []).map((lbl: string) => (
                                                <span key={lbl} className="report-finding-group-state-tag">{lbl}</span>
                                              ))}
                                            </strong>
                                            <small>{item.ruleId || item.wcagCriterion || item.criterion || row.id}</small>
                                          </span>
                                          <span className={`report-severity-chip ${getSeverityClass(item.severity)}`}>{item.severity || 'medio'}</span>
                                        </summary>

                                        <article className="report-finding-detail-card">
                                          <div className="report-finding-detail-header">
                                            <div>
                                              <p className="report-finding-detail-kicker">Grupo {itemIndex + 1} de {findingCount}</p>
                                              <h4>
                                                {item.nameEs || row.nombre}
                                                {(item.pageStateLabels?.length > 1 ? item.pageStateLabels : item.pageStateLabel ? [item.pageStateLabel] : []).map((lbl: string) => (
                                                  <span key={lbl} className="report-finding-group-state-tag">{lbl}</span>
                                                ))}
                                              </h4>
                                            </div>
                                            <div className="report-finding-detail-badges">
                                              <span className={`report-status-badge ${getFindingStatusClass(item)}`}>{getFindingStatusLabel(item)}</span>
                                              <span className="report-elements-badge">{occurrenceCount} elemento{occurrenceCount === 1 ? '' : 's'} afectado{occurrenceCount === 1 ? '' : 's'}</span>
                                            </div>
                                          </div>

                                          <div className="report-review-actions" aria-label={`Acciones de revisión para ${item.nameEs || row.nombre}`}>
                                            <div>
                                              <span>Decisión del auditor</span>
                                              <p>Confirma el resultado después de revisar la evidencia, el HTML y el contexto real.</p>
                                            </div>
                                            <div className="report-review-action-buttons">
                                              <button
                                                type="button"
                                                className="report-review-btn report-review-pass"
                                                disabled={updatingFindingKey === getFindingReviewKey(item)}
                                                onClick={() => onFindingStatusUpdate(item, 'not_applicable')}
                                              >
                                                Confirmar cumple
                                              </button>
                                              <button
                                                type="button"
                                                className="report-review-btn report-review-fail"
                                                disabled={updatingFindingKey === getFindingReviewKey(item)}
                                                onClick={() => onFindingStatusUpdate(item, 'confirmed')}
                                              >
                                                Confirmar falla
                                              </button>
                                              <button
                                                type="button"
                                                className="report-review-btn report-review-pending"
                                                disabled={updatingFindingKey === getFindingReviewKey(item)}
                                                onClick={() => onFindingStatusUpdate(item, 'needs_review')}
                                              >
                                                Dejar en revisión
                                              </button>
                                            </div>
                                          </div>

                                          <div className="report-finding-detail-grid">
                                            <div><span>Fuente</span><strong>{getFindingSourceLabel(item)}</strong></div>
                                            <div><span>Vista evaluada</span><strong>
                                              {item.pageStateLabels?.length > 0
                                                ? item.pageStateLabels.join(' · ')
                                                : getPageStateLabel(item)}
                                            </strong></div>
                                            <div><span>Rol responsable</span><strong>{item.role || 'Por asignar'}</strong></div>
                                            <div><span>Impacto</span><strong>{getFindingImpact(item)}</strong></div>
                                            <div><span>Criterio WCAG</span><strong>{item.wcagCriterion || item.criterion || row.id}</strong></div>
                                            <div><span>Regla</span><strong>{getFriendlyRuleName(item)}{item.ruleId && item.nameEs ? <span className="report-rule-id-sub">{item.ruleId}</span> : null}</strong></div>
                                          </div>

                                          <div className="report-finding-detail-copy">
                                            <div><span>Descripción</span><p>{canUsePaidFeatures ? (getFindingDescriptionSummary([item]) || 'Sin descripción técnica disponible.') : 'Disponible en Pro'}</p></div>
                                            <div><span>Selector principal</span>{item.selector ? <code className="report-code">{item.selector}</code> : <p>Sin selector disponible.</p>}</div>
                                            <div><span>Solución sugerida</span><p>{canUsePaidFeatures ? (item.suggestedFix || 'Sin solución sugerida registrada.') : 'Disponible en Pro'}</p></div>
                                            {canUsePaidFeatures && item.fixScope === 'page' && (
                                              <div className="report-page-fix-note" role="note">
                                                <strong>Corrección única a nivel de página:</strong> un solo cambio estructural resuelve todos los elementos listados en este grupo — no es necesario corregirlos uno por uno.
                                              </div>
                                            )}
                                            {canUsePaidFeatures && item.fixExample && (
                                              <div>
                                                <span>Ejemplo de código</span>
                                                <pre className="report-html-block report-fix-example"><code>{item.fixExample}</code></pre>
                                              </div>
                                            )}
                                            {item.wcagUrl && <a href={item.wcagUrl} target="_blank" rel="noreferrer" className="report-reference-link">Ver criterio WCAG oficial</a>}
                                          </div>

                                          {occurrenceItems.length > 0 && (
                                            <div className="report-finding-occurrences">
                                              <div className="report-finding-occurrences-head">
                                                <span>Elementos dentro de este grupo</span>
                                                <strong>{occurrenceCount}</strong>
                                              </div>
                                              <div className="report-occurrence-table">
                                                <div className="report-occurrence-table-head">
                                                  <span>#</span>
                                                  <span>Selector CSS</span>
                                                  <span>HTML afectado</span>
                                                  <span>Corrección</span>
                                                </div>
                                                {occurrenceItems.slice(0, 20).map((occurrence: string, occurrenceIndex: number) => {
                                                  const htmlSample = affectedSamples[occurrenceIndex] || item.elementHtml || '';
                                                  const visibleText = getVisibleTextFromHtml(htmlSample);
                                                  // En reglas page-level no repetir la misma frase por elemento:
                                                  // la corrección es una sola y ya se explicó arriba.
                                                  const elementFix = item.fixScope === 'page'
                                                    ? 'Se resuelve con la corrección única a nivel de página indicada arriba.'
                                                    : (item.elementFix || item.suggestedFix || 'Revisar contexto WCAG.');
                                                  return (
                                                    <div key={`${row.id}-${itemIndex}-${occurrenceIndex}`} className="report-occurrence-table-row">
                                                      <span className="report-occurrence-num">{occurrenceIndex + 1}</span>
                                                      <div className="report-occurrence-selector-cell">
                                                        <code className="report-occurrence-selector">{occurrence}</code>
                                                        {visibleText && <em className="report-occurrence-visible">"{visibleText}"</em>}
                                                      </div>
                                                      <pre className="report-occurrence-html"><code>{htmlSample || '—'}</code></pre>
                                                      <p className="report-occurrence-fix">{elementFix}</p>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                              {occurrenceItems.length > 20 && (
                                                <p className="report-finding-occurrence-note">+{occurrenceItems.length - 20} elementos adicionales agrupados en este mismo problema.</p>
                                              )}
                                            </div>
                                          )}

                                          <div className="report-finding-evidence-grid">
                                            <div>
                                              <p className="report-finding-detail-kicker">HTML del elemento principal</p>
                                              <pre className="report-html-block"><code>{item.elementHtml || 'Sin fragmento HTML disponible.'}</code></pre>
                                            </div>
                                            <div className="report-finding-evidence-thumb">
                                              <p className="report-finding-detail-kicker">Evidencia visual de la página</p>
                                              {evidenceUrl
                                                ? <EvidencePreview url={evidenceUrl} />
                                                : <div className="report-no-evidence">Sin evidencia visual disponible</div>
                                              }
                                            </div>
                                          </div>
                                        </article>
                                      </details>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

          </>
        )}
      </div>
    </div>
  );
}

