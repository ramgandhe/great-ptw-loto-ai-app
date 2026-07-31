import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { HealthService, SystemService } from '../app/src/modules/system/system.service';
import { DATABASE_POOL } from '../app/src/database/database.module';
import { RedisHealthService } from '../app/src/infrastructure/redis/redis.service';
import { StorageService } from '../app/src/infrastructure/storage/storage.service';
import { QueueService } from '../app/src/infrastructure/queue/queue.service';
import configuration from '../app/src/config/configuration';
import { PLATFORM_VERSION } from '@ptw/shared';

describe('SystemService', () => {
  let systemService: SystemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
        }),
      ],
      providers: [SystemService],
    }).compile();

    systemService = module.get(SystemService);
  });

  it('returns client configuration', () => {
    const config = systemService.getConfig();
    expect(config.keycloakRealm).toBe('ptw-platform');
    expect(config.keycloakClientId).toBe('ptw-web');
    expect(config.apiBaseUrl).toBe('/api/v1');
  });

  it('returns version information', () => {
    const version = systemService.getVersion();
    expect(version.version).toBe(PLATFORM_VERSION);
    expect(version.apiVersion).toBe('v1');
  });
});

describe('HealthService', () => {
  let healthService: HealthService;

  const mockPool = {
    query: jest.fn().mockRejectedValue(new Error('Database unavailable')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
        }),
      ],
      providers: [
        HealthService,
        { provide: DATABASE_POOL, useValue: mockPool },
        { provide: RedisHealthService, useValue: { ping: jest.fn().mockResolvedValue(false) } },
        { provide: StorageService, useValue: { isHealthy: jest.fn().mockResolvedValue(false) } },
        { provide: QueueService, useValue: { isHealthy: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    healthService = module.get(HealthService);
  });

  it('reports degraded status when services are unavailable', async () => {
    const result = await healthService.check();
    expect(result.version).toBe(PLATFORM_VERSION);
    expect(['degraded', 'unhealthy']).toContain(result.status);
    expect(result.services.database.status).toBe('down');
  });
});

describe('AuthService', () => {
  it('maps authenticated user to profile', async () => {
    const { AuthService } = await import('../app/src/modules/auth/auth.service');
    const authService = new AuthService();

    const profile = authService.getProfile({
      id: 'user-1',
      username: 'admin',
      email: 'admin@ptw.local',
      roles: ['platform-admin'],
    });

    expect(profile.username).toBe('admin');
    expect(profile.roles).toContain('platform-admin');
  });
});
