import { Job } from 'bullmq';
import pg from 'pg';
import { scanUrl } from './scanner.js';
import { validateScanTargetUrls } from './urlPolicy.js';
import { deleteEvidenceUrls, runWithScanContext } from './storage.js';
import { createLogger } from './logger.js';
import { getRedisClient } from './redis-client.js';

const log = createLogger('processor');

const { Pool } = pg;

const isNeon = (process.env.DATABASE_URL || '').includes('neon.tech');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ...(isNeon ? { ssl: { rejectUnauthorized: false } } : {}),
      }
    : {
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
        user: process.env.DB_USER || process.env.PGUSER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
        database: process.env.DB_NAME || process.env.PGDATABASE || 'accessibility_db',
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }
);

// Invalida todas las entradas de caché para un scan dado usando SCAN cursor.
// No-fatal: si Redis no está disponible, la caché expira sola (máx 8s activa, 5min terminal).
async function invalidateScanCache(scanId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const pattern = `scan:cache:${scanId}:*`;
    let cursor = '0';
    const toDelete: string[] = [];
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      toDelete.push(...keys);
    } while (cursor !== '0');
    if (toDelete.length) {
      await redis.del(...toDelete);
      log.info('Cache invalidada', { scanId, keys: toDelete.length });
    }
  } catch (err) {
    log.warn('Cache invalidation fallida (no-fatal)', { scanId, error: (err as Error)?.message });
  }
}

let schemaChecked = false;

// Verifica que las columnas esperadas existan. No hace ALTER TABLE — las migraciones
// deben aplicarse antes del deploy, no en runtime (riesgo de table locks en producción).
async function ensureUrlResultSchema(): Promise<void> {
  if (schemaChecked) return;
  schemaChecked = true;

  const expected = ['applicability', 'engineReport', 'focusTraversal', 'semanticStructure', 'visualMap', 'peruvianChecks'];
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'url_results' AND column_name = ANY($1)`,
    [expected],
  );
  const found = new Set(result.rows.map((r) => r.column_name));
  const missing = expected.filter((col) => !found.has(col));

  if (missing.length > 0) {
    // En desarrollo aplicamos las columnas faltantes para facilitar onboarding.
    // En producción fallamos rápido: el schema debe aplicarse mediante migración antes del deploy.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `[SCHEMA] Columnas faltantes en url_results: ${missing.join(', ')}. ` +
        `Aplica las migraciones antes de iniciar el worker en producción.`,
      );
    }
    log.warn(`Aplicando columnas faltantes en desarrollo: ${missing.join(', ')}`);
    for (const col of missing) {
      await pool.query(`ALTER TABLE url_results ADD COLUMN IF NOT EXISTS "${col}" jsonb`);
    }
  }
}

function collectEvidenceUrls(value: unknown, urls = new Set<string>()): Set<string> {
  if (!value) return urls;
  if (typeof value === 'string') {
    if (value.includes('/evidence/')) urls.add(value);
    return urls;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectEvidenceUrls(item, urls);
    return urls;
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectEvidenceUrls(item, urls);
    }
  }
  return urls;
}

export async function cleanupPublicScan(scanId: string): Promise<void> {
  await ensureUrlResultSchema();

  const scanResult = await pool.query(
    `SELECT s.id, s."projectId"
     FROM scans s
     JOIN projects p ON p.id = s."projectId"
     WHERE s.id = $1 AND p."ownerId" IS NULL`,
    [scanId]
  );

  if (scanResult.rowCount === 0) {
    log.info('Public scan cleanup skipped: not found or not public', { scanId });
    return;
  }

  const resultRows = await pool.query(
    `SELECT violations, "focusTraversal", "visualMap"
     FROM url_results
     WHERE "scanId" = $1`,
    [scanId]
  );

  const evidenceUrls = new Set<string>();
  for (const row of resultRows.rows) {
    collectEvidenceUrls(row.violations, evidenceUrls);
    collectEvidenceUrls(row.focusTraversal, evidenceUrls);
    collectEvidenceUrls(row.visualMap, evidenceUrls);
  }

  const deletedEvidence = await deleteEvidenceUrls(Array.from(evidenceUrls));
  await pool.query(`DELETE FROM projects WHERE id = $1 AND "ownerId" IS NULL`, [scanResult.rows[0].projectId]);

  log.info('Public scan deleted', { scanId, evidenceDeleted: deletedEvidence });
}

export async function processScan(job: Job): Promise<{ scanId: string; publicScan?: boolean }> {
  const { scanId, urls, scanMode, preNavigationScript, publicScan } = job.data;
  log.info('Scan started', { scanId, urlCount: urls?.length, scanMode, publicScan });
  await ensureUrlResultSchema(); // no-op after first run in this process

  // runWithScanContext usa AsyncLocalStorage: el contexto isPublic queda aislado
  // por cadena de promesas, por lo que con concurrencia 3 cada scan tiene su
  // propio contexto y no puede contaminar al de otro.
  return runWithScanContext(Boolean(publicScan), () => _processScanBody(job, scanId, urls, scanMode, preNavigationScript, publicScan));
}

async function _processScanBody(
  job: Job,
  scanId: string,
  urls: string[],
  scanMode: string,
  preNavigationScript: string | undefined,
  publicScan: boolean | undefined,
): Promise<{ scanId: string; publicScan?: boolean }> {

  // Update scan status to running
  await pool.query(
    `UPDATE scans SET status = 'running' WHERE id = $1`,
    [scanId]
  );

  let validatedUrls: string[];
  try {
    validatedUrls = await validateScanTargetUrls(urls);
  } catch (err) {
    log.error('Rejected unsafe scan payload', { scanId, error: (err as Error)?.message });
    await pool.query(
      `UPDATE scans SET status = 'failed' WHERE id = $1`,
      [scanId]
    );
    await invalidateScanCache(scanId);
    throw err;
  }
  if (preNavigationScript) {
    log.warn('preNavigationScript ignorado: scripts deshabilitados por defecto', { scanId });
  }

  const totalUrls = validatedUrls.length;
  const results = [];

  const MAX_URL_RETRIES = 2;
  // Timeout máximo por URL: 8 min en scan profundo (3 viewports paralelos + IBM + screenshots),
  // 4 min en scan estándar. Evita que una página que no carga o IBM bloqueado congele el job.
  const URL_SCAN_TIMEOUT_MS = (scanMode === 'profundo' ? 8 : 4) * 60 * 1000;

  // Delay mínimo entre requests al mismo dominio para no triggear anti-bot
  // ni sobrecargar el servidor objetivo. Siteimprove usa 200ms + pausa de 20s
  // si detecta impacto. Aquí usamos un valor conservador configurable.
  const INTER_DOMAIN_DELAY_MS = Number(process.env.SCAN_INTER_DOMAIN_DELAY_MS || 1500);
  const lastRequestByDomain = new Map<string, number>();

  const applyDomainRateLimit = async (targetUrl: string) => {
    let hostname: string;
    try {
      hostname = new URL(targetUrl).hostname;
    } catch {
      return;
    }
    const last = lastRequestByDomain.get(hostname);
    if (last !== undefined) {
      const elapsed = Date.now() - last;
      if (elapsed < INTER_DOMAIN_DELAY_MS) {
        const wait = INTER_DOMAIN_DELAY_MS - elapsed;
        log.info('Rate limiting: esperando antes del siguiente request al mismo dominio', { hostname, waitMs: wait });
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    lastRequestByDomain.set(hostname, Date.now());
  };

  for (let i = 0; i < totalUrls; i++) {
    const cancelCheck = await pool.query(`SELECT status FROM scans WHERE id = $1`, [scanId]);
    if (cancelCheck.rows[0]?.status === 'cancelled') {
      await pool.query(`UPDATE scans SET status = 'cancelled' WHERE id = $1`, [scanId]);
      await invalidateScanCache(scanId);
      log.info('Scan cancelled mid-execution', { scanId, urlIndex: i });
      return { scanId, publicScan };
    }

    const url = validatedUrls[i];
    await applyDomainRateLimit(url);

    let lastUrlError: unknown;
    let succeeded = false;

    for (let attempt = 0; attempt <= MAX_URL_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * 2 ** attempt, 10_000);
        log.warn('Reintentando URL con backoff', { url, attempt, maxRetries: MAX_URL_RETRIES, backoffMs });
        await new Promise((r) => setTimeout(r, backoffMs));
      }

    try {
      log.info('Scanning URL', { url, index: i + 1, total: totalUrls, attempt: attempt + 1, scanId });
      
      const viewports = [{ width: 1280, height: 800 }];
      if (scanMode === 'profundo') {
        viewports.push({ width: 768, height: 1024 });
        viewports.push({ width: 375, height: 667 });
      }

      // Los viewports corren en paralelo: cada uno usa su propio contexto incógnito
      // del browser pool, sin interferencia entre sí. El scan desktop (índice 0) recibe
      // el set completo de motores; tablet/móvil usan lightScan (solo axe).
      // Tiempo total: max(desktop, tablet, móvil) en lugar de sum — ~60% más rápido.
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`URL scan timeout after ${URL_SCAN_TIMEOUT_MS / 1000}s: ${url}`)), URL_SCAN_TIMEOUT_MS),
      );
      const viewportResults = await Promise.race([
        Promise.all(
          viewports.map((vp, viewportIndex) =>
            scanUrl(url, {
              viewport: vp,
              lightScan: viewportIndex > 0,
            }),
          ),
        ),
        timeoutPromise,
      ]);

      // Aggregate scores
      const avgScore = Math.round(viewportResults.reduce((acc, r) => acc + r.score, 0) / viewportResults.length);
      
      // Combine and deduplicate violations
      const allViolations = [];
      const seen = new Set();
      for (const vr of viewportResults) {
        for (const v of vr.violations) {
          const key = `${v.pageState || ''}::${v.normalizedRuleId || v.ruleId}-${v.selector}`;
          if (!seen.has(key)) {
            seen.add(key);
            allViolations.push(v);
          }
        }
      }

      const applicability = viewportResults[0]?.applicability || [];
      const applicabilitySummary = viewportResults[0]?.applicabilitySummary || null;
      const engineReport = viewportResults.flatMap((result, viewportIndex) =>
        (result.engineReport || []).map((entry) => ({
          ...entry,
          viewport: viewports[viewportIndex],
        }))
      );
      const focusTraversal = viewportResults[0]?.focusTraversal || null;
      const semanticStructure = viewportResults[0]?.semanticStructure || null;
      const visualMap = viewportResults[0]?.visualMap || null;

      // Detect .gob.pe for Peruvian specific compliance
      const isGobPe = url.includes('.gob.pe');
      
      const manualVerifications = [
        { id: '1.2.6-sign-language', criterion: '1.2.6', name: 'Lengua de Señas Peruana', status: 'pending', description: 'Verificar si los videos pregrabados cuentan con intérprete de señas' },
        { id: 'origin-languages', criterion: '7.4', name: 'Lenguas Originarias', status: isGobPe ? 'pending' : 'not_applicable', description: 'Para gobiernos locales/regionales, disponibilidad en quechua, aimara, etc.' },
        { id: 'support-materials', criterion: '7.5', name: 'Materiales de Apoyo', status: 'pending', description: 'Instructivos, tutoriales, asistente virtual o chat accesible' },
        { id: 'contact-channel', criterion: '7.5', name: 'Canal de Contacto', status: 'pending', description: 'Presencia de enlace de soporte o correo institucional para quejas de accesibilidad' }
      ];

      const insertQuery = `
        INSERT INTO url_results (url, score, violations, "manualVerifications", applicability, "engineReport", "focusTraversal", "semanticStructure", "visualMap", "peruvianChecks", status, "scanId")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;

      await pool.query(insertQuery, [
        url,
        avgScore,
        JSON.stringify(allViolations),
        JSON.stringify(manualVerifications),
        JSON.stringify({ criteria: applicability, summary: applicabilitySummary }),
        JSON.stringify(engineReport),
        JSON.stringify(focusTraversal),
        JSON.stringify(semanticStructure),
        JSON.stringify(visualMap),
        JSON.stringify(viewportResults[0]?.peruvianChecks ?? null),
        'completed',
        scanId,
      ]);

      results.push(avgScore);
      succeeded = true;
      break; // Éxito: salir del loop de reintentos
    } catch (urlErr) {
      lastUrlError = urlErr;
      const isLastAttempt = attempt === MAX_URL_RETRIES;
      if (isLastAttempt) {
        log.error('URL scan failed after all retries', { url, attempts: MAX_URL_RETRIES + 1, error: (urlErr as Error)?.message, scanId });
        await pool.query(
          `INSERT INTO url_results (url, score, violations, applicability, "focusTraversal", "engineReport", "semanticStructure", "visualMap", status, "scanId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [url, 0, '[]', 'null', 'null', JSON.stringify([]), JSON.stringify(null), JSON.stringify(null), 'failed', scanId]
        );
      } else {
        log.warn('URL scan attempt failed, will retry', { url, attempt: attempt + 1, maxAttempts: MAX_URL_RETRIES + 1, error: (urlErr as Error)?.message });
      }
    }
    } // fin for attempt
    void succeeded; void lastUrlError; // usadas implícitamente arriba
  }

  // Calculate final global score
  const finalScore = results.length > 0
    ? Math.round(results.reduce((acc, s) => acc + s, 0) / results.length)
    : 0;

  // Calculate Vp
  const scanQuery = `
    SELECT p.vo, s.ux FROM scans s
    JOIN projects p ON s."projectId" = p.id
    WHERE s.id = $1
  `;
  const scanInfo = await pool.query(scanQuery, [scanId]);
  let vp = null;
  if (scanInfo.rows.length > 0) {
    const vo = scanInfo.rows[0].vo || 4;
    const ux = scanInfo.rows[0].ux || 4;
    vp = vo * ux;
  }

  // Update final scan record
  await pool.query(
    `UPDATE scans SET status = 'completed', "globalScore" = $1, vp = $2 WHERE id = $3`,
    [finalScore, vp, scanId]
  );

  await invalidateScanCache(scanId);
  await job.updateProgress({ scanId, value: 100 });
  return { scanId, publicScan };
}
