import { Injectable, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
}
