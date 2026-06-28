import { Injectable, NotFoundException } from '@nestjs/common';
import { DeleteObjectsCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.STORAGE_ENDPOINT
  || (process.env.CLOUDFLARE_ACCOUNT_ID
    ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : '')
  || (process.env.MINIO_ENDPOINT
    ? `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || '9000'}`
    : 'http://localhost:9000');
const bucketName = process.env.STORAGE_BUCKET_NAME || process.env.R2_BUCKET_NAME || process.env.MINIO_BUCKET || 'accessibility-evidence';
const region = process.env.STORAGE_REGION || process.env.R2_REGION || 'auto';
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
    'Configura las variables de entorno antes de iniciar el servidor.',
  );
}
const forcePathStyle = String(process.env.STORAGE_FORCE_PATH_STYLE || process.env.MINIO_FORCE_PATH_STYLE || '').toLowerCase() === 'true'
  || (!process.env.STORAGE_ENDPOINT && !process.env.R2_REGION && process.env.MINIO_ENDPOINT ? true : false);

// Presigned URLs expire after 1 hour — sufficient for a browser session viewing a report.
const PRESIGNED_URL_TTL_SECONDS = 3600;

@Injectable()
export class EvidenceService {
  private readonly s3Client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle,
  });

  async getPresignedUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
      return await getSignedUrl(this.s3Client, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
    } catch {
      throw new NotFoundException('Evidence not found');
    }
  }

  private extractKeyFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/evidence\/(.+)$/);
      return match ? decodeURIComponent(match[1]) : '';
    } catch {
      const match = url.match(/\/evidence\/([^?#]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    }
  }

  async deleteEvidenceForScan(urlResults: any[]): Promise<number> {
    const urls = new Set<string>();

    for (const ur of urlResults ?? []) {
      const states = ur?.visualMap?.states ?? [];
      for (const state of states) {
        if (state?.screenshotUrl) urls.add(state.screenshotUrl);
      }
      if (ur?.focusTraversal?.screenshotUrl) urls.add(ur.focusTraversal.screenshotUrl);
      for (const v of ur?.violations ?? []) {
        if (v?.screenshotUrl) urls.add(v.screenshotUrl);
      }
    }

    const keys = [...urls].map((u) => this.extractKeyFromUrl(u)).filter(Boolean);
    if (keys.length === 0) return 0;

    let deleted = 0;
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      try {
        await this.s3Client.send(new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }));
        deleted += batch.length;
      } catch (err) {
        console.error(`R2 batch delete error (offset ${i}):`, err);
      }
    }
    return deleted;
  }
}
