import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: Minio.Client;
  /** Signs browser links for the public MinIO address; no network calls (region is fixed). */
  private signer!: Minio.Client;
  private bucket!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.bucket = this.configService.get<string>('minio.bucket')!;
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('minio.endPoint')!,
      port: this.configService.get<number>('minio.port')!,
      useSSL: this.configService.get<boolean>('minio.useSSL')!,
      accessKey: this.configService.get<string>('minio.accessKey')!,
      secretKey: this.configService.get<string>('minio.secretKey')!,
    });
    const publicUrl = this.configService.get<string>('minio.publicUrl');
    if (!publicUrl) {
      this.signer = this.client;
      return;
    }
    const url = new URL(publicUrl);
    const useSSL = url.protocol === 'https:';
    this.signer = new Minio.Client({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : useSSL ? 443 : 80,
      useSSL,
      region: 'us-east-1',
      accessKey: this.configService.get<string>('minio.accessKey')!,
      secretKey: this.configService.get<string>('minio.secretKey')!,
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (error) {
      this.logger.warn('MinIO unavailable at startup');
      this.logger.debug(error);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.client.bucketExists(this.bucket);
    } catch {
      return false;
    }
  }

  getClient(): Minio.Client {
    return this.client;
  }

  getBucket(): string {
    return this.bucket;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
    size: number,
  ): Promise<void> {
    try {
      await this.client.putObject(this.bucket, key, body, size, {
        'Content-Type': contentType,
      });
    } catch {
      await this.ensureBucket();
      await this.client.putObject(this.bucket, key, body, size, {
        'Content-Type': contentType,
      });
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async presignedGetObject(key: string, expirySeconds: number): Promise<string> {
    return this.signer.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async presignedPutObject(key: string, expirySeconds: number): Promise<string> {
    return this.signer.presignedPutObject(this.bucket, key, expirySeconds);
  }
}
