import { Job } from 'bullmq';
import pg from 'pg';
import { scanUrl } from './scanner.js';
import { validateScanTargetUrls } from './urlPolicy.js';
import { deleteEvidenceUrls, deleteOrphanEvidence, runWithScanContext } from './storage.js';
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

// Invalida las entradas de caché de un scan. El API registra cada variante de
// caché en el SET scan:cachekeys:{id}, así que basta SMEMBERS + DEL (2-3
// comandos) en lugar de un SCAN sobre todo el keyspace (que recorría también
// las miles de llaves de BullMQ en cada invalidación).
// No-fatal: si Redis no está disponible, la caché expira sola (máx 8s).
async function invalidateScanCache(scanId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const setKey = `scan:cachekeys:${scanId}`;
    const tracked = await redis.smembers(setKey);
    // La variante pública siempre se incluye por si el SET expiró antes que la caché.
    const toDelete = [...new Set([...tracked, `scan:cache:${scanId}:public`])];
    await redis.del(...toDelete, setKey);
  } catch (err) {
    log.warn('Cache invalidation fallida (no-fatal)', { scanId, error: (err as Error)?.message });
  }
}

// Los scans manual_assisted quedan en awaiting_login hasta que la extensión
// envía resultados. Si el usuario nunca completa el flujo, expiran a las 24h
// para que el frontend deje de mostrarlos (y de pollearlos) como activos.
export async function expireStaleAwaitingLoginScans(): Promise<void> {
  const result = await pool.query(
    `UPDATE scans SET status = 'failed'
     WHERE status = 'awaiting_login' AND "createdAt" < NOW() - INTERVAL '24 hours'`,
  );
  if (result.rowCount) {
    log.info('Scans awaiting_login expirados por antigüedad', { count: result.rowCount });
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

function urlToEvidenceKey(url: string): string {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/evidence\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    const match = url.match(/\/evidence\/([^?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }
}

// Recorre TODOS los url_results en lotes y extrae las llaves R2 referenciadas
// en cualquier columna jsonb (violations, visualMap, focusTraversal, etc.).
async function collectLiveEvidenceKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  const BATCH = 200;
  let lastId = '';

  for (;;) {
    const { rows } = await pool.query(
      `SELECT id::text AS id, violations, "visualMap", "focusTraversal", "engineReport",
              "semanticStructure", "manualVerifications", applicability
       FROM url_results
       WHERE id::text > $1
       ORDER BY id::text
       LIMIT $2`,
      [lastId, BATCH],
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      lastId = row.id;
      const urls = new Set<string>();
      collectEvidenceUrls(row.violations, urls);
      collectEvidenceUrls(row.visualMap, urls);
      collectEvidenceUrls(row.focusTraversal, urls);
      collectEvidenceUrls(row.engineReport, urls);
      collectEvidenceUrls(row.semanticStructure, urls);
      collectEvidenceUrls(row.manualVerifications, urls);
      collectEvidenceUrls(row.applicability, urls);
      for (const url of urls) {
        const key = urlToEvidenceKey(url);
        if (key) keys.add(key);
      }
    }

    if (rows.length < BATCH) break;
  }

  return keys;
}

// Barrido de huérfanas: borra de R2 los objetos que ningún url_result referencia.
// Cubre los casos donde el borrado best-effort falló (R2 caído al eliminar un scan)
// o donde quedaron residuos históricos. Margen de 48h: los screenshots se suben
// durante el scan, antes de que su fila exista en Postgres.
const ORPHAN_MIN_AGE_MS = 48 * 60 * 60 * 1000;

export async function cleanupOrphanEvidence(): Promise<void> {
  const liveKeys = await collectLiveEvidenceKeys();
  const deleted = await deleteOrphanEvidence(liveKeys, ORPHAN_MIN_AGE_MS);
  log.info('Barrido de evidencias huérfanas completado', { liveKeys: liveKeys.size, deleted });
}

// Monitoreo continuo (Pro): reescanea el dominio de los proyectos que lo
// activaron. Corre una vez al día, pero cada proyecto solo se reescanea si su
// último scan tiene más de 6 días (cadencia semanal efectiva). Presupuesto de
// recursos acotado: máx 20 proyectos por corrida, solo dueños Pro activos.
export async function runScheduledMonitoringScans(
  enqueue: (scanId: string, url: string) => Promise<void>,
): Promise<void> {
  const { rows } = await pool.query<{ id: string; domain: string; vo: number }>(
    `SELECT p.id, p.domain, p.vo
     FROM projects p
     JOIN users u ON u.id = p."ownerId"
     WHERE p."monitoringEnabled" = true
       AND p.domain IS NOT NULL
       AND (
         lower(u.role) IN ('admin', 'superadmin')
         OR (u."billingStatus" = 'active' AND u."billingPlan" IS NOT NULL)
       )
       AND NOT EXISTS (
         SELECT 1 FROM scans s
         WHERE s."projectId" = p.id
           AND (
             s.status IN ('pending', 'running', 'awaiting_login')
             OR s."createdAt" > NOW() - INTERVAL '6 days'
           )
       )
     LIMIT 20`,
  );

  if (rows.length === 0) return;
  log.info('Monitoreo: proyectos a reescanear', { count: rows.length });

  for (const project of rows) {
    let url: string;
    try {
      [url] = await validateScanTargetUrls([project.domain]);
    } catch (err) {
      log.warn('Monitoreo: dominio inválido, se omite', { projectId: project.id, error: (err as Error)?.message });
      continue;
    }

    try {
      const vo = Number.isFinite(project.vo) && project.vo > 0 ? project.vo : 4;
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO scans (status, "scanUrls", ux, vp, "scanMode", "projectId")
         VALUES ('pending', $1::jsonb, 4, $2, 'estandar', $3)
         RETURNING id`,
        [JSON.stringify([url]), vo * 4, project.id],
      );
      const scanId = inserted.rows[0].id;
      await enqueue(scanId, url);
      log.info('Monitoreo: scan programado', { projectId: project.id, scanId });
    } catch (err) {
      log.error('Monitoreo: no se pudo programar el scan', { projectId: project.id, error: (err as Error)?.message });
    }
  }
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
  return runWithScanContext(Boolean(publicScan), () => _processScanBody(scanId, urls, scanMode, preNavigationScript, publicScan));
}

async function _processScanBody(
  scanId: string,
  urls: string[],
  scanMode: string,
  preNavigationScript: string | undefined,
  publicScan: boolean | undefined,
): Promise<{ scanId: string; publicScan?: boolean }> {

  // Transición guardada: si el usuario canceló el scan mientras estaba en cola
  // (o ya está en un estado terminal), NO lo revivimos a 'running' — antes el
  // UPDATE incondicional pisaba el 'cancelled' y el scan corría completo igual.
  const startUpdate = await pool.query(
    `UPDATE scans SET status = 'running'
     WHERE id = $1 AND status NOT IN ('cancelled', 'completed', 'failed')`,
    [scanId]
  );
  if (startUpdate.rowCount === 0) {
    log.info('Job omitido: scan cancelado o ya terminal antes de iniciar', { scanId });
    return { scanId, publicScan };
  }

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

      // Viewports secuenciales: desktop completo primero, luego tablet y móvil en lightScan.
      // Paralelo fue revertido: bajo presión de memoria los contextos simultáneos pueden
      // producir falsos negativos en axe y capturas incompletas. El timeout por URL
      // sigue activo para evitar que una página lenta congele el job.
      let timeoutHandle: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`URL scan timeout after ${URL_SCAN_TIMEOUT_MS / 1000}s: ${url}`)),
          URL_SCAN_TIMEOUT_MS,
        );
      });
      const viewportResults: Awaited<ReturnType<typeof scanUrl>>[] = [];
      try {
        for (let viewportIndex = 0; viewportIndex < viewports.length; viewportIndex++) {
          const vp = viewports[viewportIndex];
          const res = await Promise.race([
            scanUrl(url, { viewport: vp, lightScan: viewportIndex > 0 }),
            timeoutPromise,
          ]);
          viewportResults.push(res);
        }
      } finally {
        clearTimeout(timeoutHandle);
      }

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
      // Un timeout NO se reintenta: el scanUrl abandonado por Promise.race sigue
      // corriendo en background, y un reintento inmediato duplicaría contextos de
      // Chromium en paralelo (pico de memoria = riesgo de falsos negativos).
      const isTimeout = String((urlErr as Error)?.message || '').includes('URL scan timeout');
      const isLastAttempt = attempt === MAX_URL_RETRIES || isTimeout;
      if (isLastAttempt) {
        log.error('URL scan failed after all retries', { url, attempts: attempt + 1, timeout: isTimeout, error: (urlErr as Error)?.message, scanId });
        await pool.query(
          `INSERT INTO url_results (url, score, violations, applicability, "focusTraversal", "engineReport", "semanticStructure", "visualMap", status, "scanId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [url, 0, '[]', 'null', 'null', JSON.stringify([]), JSON.stringify(null), JSON.stringify(null), 'failed', scanId]
        );
        break;
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

  // Si NINGUNA URL pudo escanearse, el scan falló — antes se marcaba 'completed'
  // con score 0, indistinguible de un sitio catastróficamente inaccesible.
  const finalStatus = results.length > 0 ? 'completed' : 'failed';
  await pool.query(
    `UPDATE scans SET status = $1, "globalScore" = $2, vp = $3 WHERE id = $4`,
    [finalStatus, results.length > 0 ? finalScore : null, vp, scanId]
  );

  await invalidateScanCache(scanId);
  return { scanId, publicScan };
}
