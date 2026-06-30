import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucket: string;
  private readonly logger = new Logger(R2Service.name);

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME', 'bitwise-learning-notes');

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        region: 'auto',
      });
      this.logger.log('Cloudflare R2 Client initialized successfully');
    } else {
      this.logger.warn('Cloudflare R2 credentials not complete. Falling back to local directory serving.');
    }
  }

  isConfigured(): boolean {
    return !!this.s3Client;
  }

  async uploadFile(key: string, base64Data: string, contentType = 'application/pdf'): Promise<void> {
    if (!this.s3Client) {
      return;
    }
    const buffer = Buffer.from(base64Data, 'base64');
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    this.logger.log(`Successfully uploaded file to R2: Key=${key}`);
  }

  async getFileStream(key: string): Promise<Readable> {
    if (!this.s3Client) {
      throw new Error('R2 client not configured');
    }
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    return response.Body as Readable;
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client) {
      return;
    }
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    this.logger.log(`Successfully deleted file from R2: Key=${key}`);
  }
}
