import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PLATFORM_VERSION, ClientConfig } from '@ptw/shared';
import { RedisHealthService } from '../../infrastructure/redis/redis.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { DATABASE_POOL } from '../../database/database.module';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: Record<string, { status: 'up' | 'down'; message?: string }>;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly redisHealth: RedisHealthService,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
  ) {}

  async check(): Promise<HealthStatus> {
    const services: HealthStatus['services'] = {};

    services.database = await this.checkDatabase();
    services.redis = await this.checkRedis();
    services.minio = await this.checkMinio();
    services.bullmq = await this.checkBullmq();
    services.keycloak = this.checkKeycloak();

    const downCount = Object.values(services).filter((s) => s.status === 'down').length;
    const status =
      downCount === 0 ? 'healthy' : downCount <= 2 ? 'degraded' : 'unhealthy';

    return {
      status,
      version: PLATFORM_VERSION,
      timestamp: new Date().toISOString(),
      services,
    };
  }

  private async checkDatabase(): Promise<{ status: 'up' | 'down'; message?: string }> {
    try {
      await this.pool.query('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', message: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<{ status: 'up' | 'down'; message?: string }> {
    const ok = await this.redisHealth.ping();
    return ok ? { status: 'up' } : { status: 'down', message: 'Redis unreachable' };
  }

  private async checkMinio(): Promise<{ status: 'up' | 'down'; message?: string }> {
    const ok = await this.storageService.isHealthy();
    return ok ? { status: 'up' } : { status: 'down', message: 'MinIO unreachable' };
  }

  private async checkBullmq(): Promise<{ status: 'up' | 'down'; message?: string }> {
    const ok = await this.queueService.isHealthy();
    return ok ? { status: 'up' } : { status: 'down', message: 'BullMQ/Redis unreachable' };
  }

  private checkKeycloak(): { status: 'up' | 'down'; message?: string } {
    const url = this.configService.get<string>('keycloak.url');
    return url ? { status: 'up' } : { status: 'down', message: 'Keycloak not configured' };
  }
}

@Injectable()
export class SystemService {
  constructor(private readonly configService: ConfigService) {}

  getConfig(): ClientConfig {
    const keycloak = this.configService.get('keycloak');
    return {
      apiBaseUrl: `/api/${this.configService.get('apiVersion')}`,
      keycloakUrl: keycloak.url,
      keycloakRealm: keycloak.realm,
      keycloakClientId: 'ptw-web',
      features: this.configService.get('features') ?? {},
    };
  }

  getVersion() {
    return {
      version: PLATFORM_VERSION,
      apiVersion: this.configService.get('apiVersion'),
      environment: this.configService.get('nodeEnv'),
      buildTime: process.env.BUILD_TIME ?? null,
    };
  }
}
