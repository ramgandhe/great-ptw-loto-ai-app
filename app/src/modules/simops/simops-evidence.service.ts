import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../infrastructure/storage/storage.service';

/**
 * MinIO path helpers and presigned URLs for mitigation evidence (SP-04.02).
 * Object bytes stay in MinIO; metadata lives in PostgreSQL (BE).
 */
@Injectable()
export class SimopsEvidenceService {
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  evidenceKey(
    tenantId: string,
    conflictId: string,
    planId: string,
    fileName: string,
  ): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `simops/${tenantId}/conflicts/${conflictId}/mitigation/${planId}/${safeName}`;
  }

  private expirySeconds(): number {
    return this.configService.get<number>('simops.evidenceUrlExpirySeconds') ?? 3600;
  }

  getBucket(): string {
    return this.storageService.getBucket();
  }

  async presignedUploadUrl(
    tenantId: string,
    conflictId: string,
    planId: string,
    fileName: string,
  ): Promise<{ bucket: string; key: string; url: string; expiresInSeconds: number }> {
    const key = this.evidenceKey(tenantId, conflictId, planId, fileName);
    const expiresInSeconds = this.expirySeconds();
    const url = await this.storageService.presignedPutObject(key, expiresInSeconds);
    return { bucket: this.getBucket(), key, url, expiresInSeconds };
  }

  async presignedDownloadUrl(key: string): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = this.expirySeconds();
    const url = await this.storageService.presignedGetObject(key, expiresInSeconds);
    return { url, expiresInSeconds };
  }
}
