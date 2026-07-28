import { CacheService } from '../src/infrastructure/redis/cache.service';
import { ApprovalCacheService } from '../src/modules/approval/approval-cache.service';

describe('ApprovalCacheService (PUS-140)', () => {
  const cacheService = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
    delByPattern: jest.fn(),
  } as unknown as CacheService;

  const configService = {
    get: jest.fn().mockReturnValue(300),
  };

  const service = new ApprovalCacheService(cacheService, configService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds tenant and user scoped pending keys', () => {
    expect(service.pendingKey('tenant-1', 'user-1')).toBe('approval:pending:tenant-1:user-1');
  });

  it('invalidates tenant pending queues after approval decisions', async () => {
    await service.invalidateTenant('tenant-1');

    expect(cacheService.delByPattern).toHaveBeenCalledWith('approval:pending:tenant-1:*');
  });
});
