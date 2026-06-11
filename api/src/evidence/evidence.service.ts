import { Injectable, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

const endpoint = process.env.STORAGE_ENDPOINT
  || (process.env.MINIO_ENDPOINT
    ? `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || '9000'}`
    : 'http://localhost:9000');
const bucketName = process.env.STORAGE_BUCKET_NAME || process.env.R2_BUCKET_NAME || process.env.MINIO_BUCKET || 'accessibility-evidence';
const region = process.env.STORAGE_REGION || process.env.R2_REGION || 'us-east-1';
const accessKeyId = process.env.STORAGE_ACCESS_KEY
  || process.env.STORAGE_ACCESS_KEY_ID
  || process.env.R2_ACCESS_KEY_ID
  || process.env.MINIO_ACCESS_KEY
  || process.env.MINIO_ROOT_USER
  || 'admin';
const secretAccessKey = process.env.STORAGE_SECRET_KEY
  || process.env.STORAGE_SECRET_ACCESS_KEY
  || process.env.R2_SECRET_ACCESS_KEY
  || process.env.MINIO_SECRET_KEY
  || process.env.MINIO_ROOT_PASSWORD
  || 'admin123';
const forcePathStyle = String(process.env.STORAGE_FORCE_PATH_STYLE || process.env.MINIO_FORCE_PATH_STYLE || '').toLowerCase() === 'true'
  || (!process.env.STORAGE_ENDPOINT && !process.env.R2_REGION && process.env.MINIO_ENDPOINT ? true : false);

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

  async getEvidence(key: string): Promise<{ body: Readable; contentType: string }> {
    try {
      const result = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );

      if (!(result.Body instanceof Readable)) {
        throw new NotFoundException('Evidence not found');
      }

      const originalType = result.ContentType || 'application/octet-stream';
      const contentType = originalType === 'text/html' ? 'text/plain; charset=utf-8' : originalType;

      return { body: result.Body, contentType };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException('Evidence not found');
    }
  }
}
