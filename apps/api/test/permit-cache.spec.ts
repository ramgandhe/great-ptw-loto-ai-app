import { CacheService } from '../src/infrastructure/redis/cache.service';
import { PermitCacheService } from '../src/modules/permit/permit-cache.service';

describe('PermitCacheService', () => {
  const cacheService = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
    delByPattern: jest.fn(),
  } as unknown as CacheService;

  const configService = {
    get: jest.fn().mockReturnValue(300),
  };

  const service = new PermitCacheService(cacheService, configService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds tenant-scoped list cache keys', () => {
    expect(service.listKey('tenant-1', 'draft')).toBe('permit:list:tenant-1:draft');
    expect(service.listKey('tenant-1')).toBe('permit:list:tenant-1:all');
  });

  it('invalidates permit detail and list caches', async () => {
    await service.invalidatePermit('tenant-1', 'permit-1');

    expect(cacheService.del).toHaveBeenCalledWith('permit:detail:tenant-1:permit-1');
    expect(cacheService.delByPattern).toHaveBeenCalledWith('permit:list:tenant-1:*');
  });
});
