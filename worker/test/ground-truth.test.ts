/**
 * Test de verdad conocida (ground truth): carga una página con violaciones
 * sembradas a propósito (fixtures/ground-truth.html) y verifica que el
 * pipeline de motores (axe + heurísticas propias) detecte cada una.
 *
 * Es la misma mecánica que usan Deque (axe-test-fixtures) y las ACT Rules
 * del W3C para demostrar la consistencia de una herramienta: si un cambio
 * futuro rompe la detección de alguna regla, este test falla antes de
 * llegar a producción.
 *
 * Ejecutar:  npx tsx test/ground-truth.test.ts
 * (requiere Chromium de Playwright: npx playwright install chromium)
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { runStatefulPageEngines } from '../src/scanner-engines.js';

// Cada entrada: violación sembrada → normalizedRuleIds aceptados (alias por
// diferencias de versión de axe o de motor que la reporte).
const EXPECTED: Array<{ label: string; anyOf: string[] }> = [
  { label: 'html sin lang', anyOf: ['html-has-lang', 'html-lang-missing'] },
  { label: 'sin <title>', anyOf: ['document-title'] },
  { label: 'imagen sin alt', anyOf: ['image-alt'] },
  { label: 'alt tipo nombre de archivo', anyOf: ['suspicious-alt-text'] },
  { label: 'alts duplicados en imágenes distintas', anyOf: ['duplicate-alt-text'] },
  { label: 'contraste insuficiente', anyOf: ['color-contrast'] },
  { label: 'link con texto genérico', anyOf: ['generic-link-text'] },
  { label: 'link sin nombre accesible', anyOf: ['link-name', 'link-name-missing'] },
  { label: 'a interactivo sin href', anyOf: ['link-href-missing'] },
  { label: 'botón sin nombre', anyOf: ['button-name', 'button-name-missing'] },
  { label: 'input sin label', anyOf: ['label', 'input-name-missing', 'form-field-label-missing'] },
  { label: 'select sin nombre', anyOf: ['select-name', 'input-name-missing'] },
  { label: 'encabezado vacío', anyOf: ['empty-heading'] },
  { label: 'encabezados duplicados', anyOf: ['duplicate-headings'] },
  { label: 'li vacío', anyOf: ['empty-list-item'] },
  { label: 'aria-labelledby a id inexistente', anyOf: ['aria-valid-attr-value'] },
  { label: 'ids duplicados referenciados por ARIA', anyOf: ['duplicate-id'] },
  { label: 'contenido fuera de landmarks', anyOf: ['region'] },
  { label: 'sin landmark main', anyOf: ['landmark-main-missing', 'no-main-landmark'] },
  { label: 'sin método para saltar bloques', anyOf: ['bypass-missing', 'missing-bypass-method'] },
];

async function main() {
  const html = readFileSync(join(__dirname, 'fixtures', 'ground-truth.html'), 'utf8');

  // Servir por http local: file:// altera cómo axe evalúa algunos checks.
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'load' });

    const { findings } = await runStatefulPageEngines(page, 'initial');
    const detected = new Set(findings.map((f) => f.normalizedRuleId || f.ruleId));

    const missing = EXPECTED.filter((e) => !e.anyOf.some((id) => detected.has(id)));
    const detectedList = [...detected].sort();

    console.log(`Reglas detectadas (${detectedList.length}):`, detectedList.join(', '));

    if (missing.length > 0) {
      console.error('\nVIOLACIONES SEMBRADAS NO DETECTADAS:');
      for (const m of missing) {
        console.error(` ✗ ${m.label} (esperaba: ${m.anyOf.join(' | ')})`);
      }
    }
    assert.equal(
      missing.length,
      0,
      `${missing.length} violaciones sembradas no fueron detectadas`,
    );

    console.log(`\nground truth OK: ${EXPECTED.length}/${EXPECTED.length} violaciones sembradas detectadas`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
