import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.MINIO_ENDPOINT ? `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || '9000'}` : 'http://localhost:9000';
const accessKeyId = process.env.MINIO_ROOT_USER || 'admin';
const secretAccessKey = process.env.MINIO_ROOT_PASSWORD || 'admin123';
const bucketName = 'accessibility-evidence';

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

        // Set public read bucket policy so that screenshots can be viewed in the dashboard directly
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicRead',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };

        await s3Client.send(
          new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(policy),
          })
        );
        console.log(`Public read policy set for bucket '${bucketName}'.`);
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('Error initializing storage bucket:', err);
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
  
  // Return the public URL for accessing the object
  const publicEndpoint = process.env.PUBLIC_MINIO_ENDPOINT || 'http://localhost:9000';
  return `${publicEndpoint}/${bucketName}/${key}`;
}
