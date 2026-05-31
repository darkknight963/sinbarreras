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

const endpoint = process.env.MINIO_ENDPOINT ? `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || '9000'}` : 'http://localhost:9000';
const accessKeyId = process.env.MINIO_ROOT_USER || 'admin';
const secretAccessKey = process.env.MINIO_ROOT_PASSWORD || 'admin123';
const bucketName = 'accessibility-evidence';
const retentionDays = Number.parseInt(process.env.EVIDENCE_RETENTION_DAYS || '0', 10);

export const s3Client = new S3Client({
  endpoint,
  region: 'us-east-1', // MinIO ignores region but SDK needs it
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // required for MinIO
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

    await cleanupExpiredEvidence();
  } catch (err) {
    console.error('Error initializing storage bucket:', err);
  }
}

async function cleanupExpiredEvidence(): Promise<void> {
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

export async function uploadEvidence(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);

  const publicApiEndpoint = process.env.PUBLIC_API_ENDPOINT || 'http://localhost:3000';
  return `${publicApiEndpoint}/evidence/${encodeURIComponent(key)}`;
}
