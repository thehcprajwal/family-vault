import type { SNSEvent } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: SNSEvent): Promise<void> => {
  for (const record of event.Records) {
    const { s3Key, bucket } = JSON.parse(record.Sns.Message) as {
      s3Key: string;
      bucket: string;
    };

    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }));
  }
};
