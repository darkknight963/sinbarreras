import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  DeleteBucketPolicyCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const storageEndpoint = process.env.STORAGE_ENDPOINT
  || (process.env.CLOUDFLARE_ACCOUNT_ID
    ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : '')
  || (process.env.MINIO_ENDPOINT
    ? `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || '9000'}`
    : 'http://localhost:9000');
const accessKeyId = process.env.STORAGE_ACCESS_KEY
  || process.env.STORAGE_ACCESS_KEY_ID
  || process.env.R2_ACCESS_KEY_ID
  || process.env.MINIO_ACCESS_KEY
  || process.env.MINIO_ROOT_USER
  || '';
const secretAccessKey = process.env.STORAGE_SECRET_KEY
  || process.env.STORAGE_SECRET_ACCESS_KEY
  || process.env.R2_SECRET_ACCESS_KEY
  || process.env.MINIO_SECRET_KEY
  || process.env.MINIO_ROOT_PASSWORD
  || '';

if (process.env.NODE_ENV === 'production' && (!accessKeyId || !secretAccessKey)) {
  throw new Error(
    'STORAGE_ACCESS_KEY y STORAGE_SECRET_KEY son requeridos en producción. ' +
    'Configura las variables de entorno antes de iniciar el worker.',
  );
}
const bucketName = process.env.STORAGE_BUCKET_NAME
  || process.env.R2_BUCKET_NAME
  || process.env.MINIO_BUCKET
  || 'accessibility-evidence';
const region = process.env.STORAGE_REGION || process.env.R2_REGION || 'us-east-1';
const forcePathStyle = String(process.env.STORAGE_FORCE_PATH_STYLE || process.env.MINIO_FORCE_PATH_STYLE || '').toLowerCase() === 'true'
  || (!process.env.STORAGE_ENDPOINT && !process.env.R2_REGION && process.env.MINIO_ENDPOINT ? true : false);
const retentionDays = Number.parseInt(process.env.EVIDENCE_RETENTION_DAYS || '0', 10);

export const s3Client = new S3Client({
  endpoint: storageEndpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle,
});

export async function initializeStorage(): Promise<void> {
  try {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket '${bucketName}' already exists.`);
    } catch (err: any) {
      if (err.name === 'NotFound' || err['$metadata']?.httpStatusCode === 404 || err.statusCode === 404) {
        console.log(`Bucket '${bucketName}' not found. Creating it...`);
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket '${bucketName}' created successfully.`);

      } else {
        throw err;
      }
    }

    try {
      await s3Client.send(new DeleteBucketPolicyCommand({ Bucket: bucketName }));
      console.log(`Public bucket policy removed for '${bucketName}'.`);
    } catch {
      console.log(`Bucket '${bucketName}' has no public policy to remove.`);
    }

  } catch (err) {
    console.error('Error initializing storage bucket:', err);
  }
}

export async function cleanupExpiredEvidence(): Promise<void> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return;
  }

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let continuationToken: string | undefined;
  let deletedObjects = 0;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      })
    );

    const expired = (response.Contents || [])
      .filter((object) => object.Key && object.LastModified && object.LastModified.getTime() < cutoffMs)
      .map((object) => ({ Key: object.Key! }));

    if (expired.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: expired,
            Quiet: true,
          },
        })
      );
      deletedObjects += expired.length;
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  if (deletedObjects > 0) {
    console.log(`Deleted ${deletedObjects} expired evidence object(s) from '${bucketName}'.`);
  }
}

// Borra objetos de R2 que NO están referenciados por ningún url_result vivo.
// liveKeys: llaves extraídas de Postgres. minAgeMs: margen de seguridad — los
// screenshots se suben DURANTE el scan, antes de que exista su fila en la BD,
// así que nunca tocamos objetos recientes.
export async function deleteOrphanEvidence(liveKeys: Set<string>, minAgeMs: number): Promise<number> {
  const cutoffMs = Date.now() - minAgeMs;
  let continuationToken: string | undefined;
  let deletedObjects = 0;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      })
    );

    const orphans = (response.Contents || [])
      .filter((object) =>
        object.Key &&
        object.LastModified &&
        object.LastModified.getTime() < cutoffMs &&
        !liveKeys.has(object.Key),
      )
      .map((object) => ({ Key: object.Key! }));

    if (orphans.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: orphans, Quiet: true },
        })
      );
      deletedObjects += orphans.length;
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return deletedObjects;
}

import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage garantiza aislamiento por llamada asíncrona: con concurrencia 3,
// cada scan tiene su propio contexto y no puede contaminar al de otro.
const scanContext = new AsyncLocalStorage<{ isPublic: boolean }>();

export function runWithScanContext<T>(isPublic: boolean, fn: () => Promise<T>): Promise<T> {
  return scanContext.run({ isPublic }, fn);
}

// isPublicScan: si true, la evidencia es de un análisis gratuito (sin usuario) y se sube
// con prefijo 'public/' para ser servida por el endpoint público sin autenticación.
// Las evidencias de scans autenticados no llevan el prefijo y requieren sesión para accederse.
export async function uploadEvidence(
  key: string,
  body: Buffer | string,
  contentType: string,
): Promise<string> {
  const isPublicScan = scanContext.getStore()?.isPublic ?? false;
  const storageKey = isPublicScan ? `public/${key}` : key;
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command, { requestTimeout: 30_000 });

  const publicEvidenceBaseUrl =
    process.env.STORAGE_PUBLIC_BASE_URL ||
    process.env.PUBLIC_API_ENDPOINT ||
    process.env.PUBLIC_STORAGE_URL ||
    'http://localhost:3000';

  const urlPath = isPublicScan
    ? `/evidence/public/${encodeURIComponent(key)}`
    : `/evidence/${encodeURIComponent(key)}`;

  return `${publicEvidenceBaseUrl.replace(/\/+$/, '')}${urlPath}`;
}

export async function deleteEvidenceUrls(urls: string[]): Promise<number> {
  const keys = Array.from(new Set(urls.map((url) => {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/evidence\/(.+)$/);
      return match ? decodeURIComponent(match[1]) : '';
    } catch {
      const match = url.match(/\/evidence\/([^?#]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    }
  }).filter(Boolean)));

  if (keys.length === 0) {
    return 0;
  }

  let deletedObjects = 0;
  for (let index = 0; index < keys.length; index += 1000) {
    const batch = keys.slice(index, index + 1000);
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
    deletedObjects += batch.length;
  }

  return deletedObjects;
}
