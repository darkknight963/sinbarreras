import { Injectable, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

const endpoint = process.env.MINIO_ENDPOINT
  ? `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || '9000'}`
  : 'http://localhost:9000';

const bucketName = 'accessibility-evidence';

@Injectable()
export class EvidenceService {
  private readonly s3Client = new S3Client({
    endpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER || 'admin',
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'admin123',
    },
    forcePathStyle: true,
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
