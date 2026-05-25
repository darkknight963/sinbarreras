import { Job } from 'bullmq';
import pg from 'pg';
import { scanUrl } from './scanner.js';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'accessibility_db',
});

export async function processScan(job: Job): Promise<void> {
  const { scanId, urls, scanMode, preNavigationScript } = job.data;
  console.log(`Starting execution of Scan ID: ${scanId}`);

  // Update scan status to running
  await pool.query(
    `UPDATE scans SET status = 'running' WHERE id = $1`,
    [scanId]
  );

  const totalUrls = urls.length;
  const results = [];

  for (let i = 0; i < totalUrls; i++) {
    const url = urls[i];
    const urlProgressStart = (i / totalUrls) * 100;
    
    // Update progress
    await job.updateProgress(Math.round(urlProgressStart));

    try {
      console.log(`Scanning URL [${i + 1}/${totalUrls}]: ${url}`);
      
      const viewports = [{ width: 1280, height: 800 }];
      if (scanMode === 'profundo') {
        viewports.push({ width: 768, height: 1024 });
        viewports.push({ width: 375, height: 667 });
      }

      const viewportResults = [];
      for (const vp of viewports) {
        const res = await scanUrl(url, {
          viewport: vp,
          preNavigationScript,
        });
        viewportResults.push(res);
      }

      // Aggregate scores
      const avgScore = Math.round(viewportResults.reduce((acc, r) => acc + r.score, 0) / viewportResults.length);
      
      // Combine and deduplicate violations
      const allViolations = [];
      const seen = new Set();
      for (const vr of viewportResults) {
        for (const v of vr.violations) {
          const key = `${v.normalizedRuleId || v.ruleId}-${v.selector}`;
          if (!seen.has(key)) {
            seen.add(key);
            allViolations.push(v);
          }
        }
      }

      // Detect .gob.pe for Peruvian specific compliance
      const isGobPe = url.includes('.gob.pe');
      
      const manualVerifications = [
        { id: '1.2.6-sign-language', criterion: '1.2.6', name: 'Lengua de Señas Peruana', status: 'pending', description: 'Verificar si los videos pregrabados cuentan con intérprete de señas' },
        { id: 'origin-languages', criterion: '7.4', name: 'Lenguas Originarias', status: isGobPe ? 'pending' : 'not_applicable', description: 'Para gobiernos locales/regionales, disponibilidad en quechua, aimara, etc.' },
        { id: 'support-materials', criterion: '7.5', name: 'Materiales de Apoyo', status: 'pending', description: 'Instructivos, tutoriales, asistente virtual o chat accesible' },
        { id: 'contact-channel', criterion: '7.5', name: 'Canal de Contacto', status: 'pending', description: 'Presencia de enlace de soporte o correo institucional para quejas de accesibilidad' }
      ];

      const insertQuery = `
        INSERT INTO url_results (url, score, violations, "manualVerifications", status, "scanId")
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await pool.query(insertQuery, [
        url,
        avgScore,
        JSON.stringify(allViolations),
        JSON.stringify(manualVerifications),
        'completed',
        scanId,
      ]);

      results.push(avgScore);
    } catch (urlErr) {
      console.error(`Error scanning URL ${url}:`, urlErr);
      await pool.query(
        `INSERT INTO url_results (url, score, status, "scanId") VALUES ($1, $2, $3, $4)`,
        [url, 0, 'failed', scanId]
      );
    }
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

  await job.updateProgress(100);
}
