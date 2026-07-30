import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { EvidenceService } from '../app/src/modules/execution/evidence.service';
import { ExecutionEvidenceService } from '../app/src/modules/execution/execution-evidence.service';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';

describe('ExecutionEvidenceService (PUS-145)', () => {
  const db = {
    select: jest.fn(),
  };

  const storageService = {
    presignedGetObject: jest.fn().mockResolvedValue('https://minio.example/evidence.jpg'),
  };

  const configService = {
    get: jest.fn().mockReturnValue(3600),
  };

  const service = new ExecutionEvidenceService(
    db as never,
    storageService as never,
    configService as never,
  );

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    username: 'viewer',
    tenantId: 'tenant-1',
    roles: ['viewer'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('denies evidence download for users without execution read roles', async () => {
    const unauthorized: AuthenticatedUser = {
      ...viewer,
      roles: ['unauthorised-role'],
    };

    await expect(
      service.getDownloadUrl('permit-1', 'evidence-1', unauthorized),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns presigned download url for authorised viewers', async () => {
    const permit = {
      id: 'permit-1',
      tenantId: 'tenant-1',
      status: 'active',
    };
    const evidence = {
      id: 'evidence-1',
      permitId: 'permit-1',
      storageKey: 'tenant-1/permit-1/evidence.jpg',
    };

    const permitSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([permit]),
    };
    const evidenceSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([evidence]),
    };

    db.select = jest
      .fn()
      .mockReturnValueOnce(permitSelect)
      .mockReturnValueOnce(evidenceSelect);

    const result = await service.getDownloadUrl('permit-1', 'evidence-1', viewer);

    expect(storageService.presignedGetObject).toHaveBeenCalledWith(
      'tenant-1/permit-1/evidence.jpg',
      3600,
    );
    expect(result.url).toContain('minio.example');
    expect(result.expiresInSeconds).toBe(3600);
  });

  it('returns presigned download url for closed permit evidence', async () => {
    const permit = {
      id: 'permit-1',
      tenantId: 'tenant-1',
      status: 'closed',
    };
    const evidence = {
      id: 'evidence-1',
      permitId: 'permit-1',
      storageKey: 'tenant-1/permit-1/evidence.jpg',
    };

    const permitSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([permit]),
    };
    const evidenceSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([evidence]),
    };

    db.select = jest
      .fn()
      .mockReturnValueOnce(permitSelect)
      .mockReturnValueOnce(evidenceSelect);

    const result = await service.getDownloadUrl('permit-1', 'evidence-1', viewer);

    expect(result.url).toContain('minio.example');
  });
});

describe('EvidenceService MinIO upload (PUS-145)', () => {
  const storageService = {
    getBucket: jest.fn().mockReturnValue('ptw-documents'),
    putObject: jest.fn(),
  };

  const permitService = {
    findOne: jest.fn().mockResolvedValue({
      permit: { id: 'permit-1', status: 'active', tenantId: 'tenant-1' },
    }),
  };

  const db = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ id: 'exec-1', permitId: 'permit-1' }]),
    }),
    insert: jest.fn(),
  };

  const service = new EvidenceService(
    db as never,
    permitService as never,
    storageService as never,
    { enqueueExecutionNotification: jest.fn() } as never,
    { log: jest.fn() } as never,
    { invalidatePermit: jest.fn() } as never,
    { invalidatePermit: jest.fn() } as never,
    { logEvent: jest.fn() } as never,
  );

  const operator: AuthenticatedUser = {
    id: 'operator-id',
    username: 'operator',
    tenantId: 'tenant-1',
    roles: ['org-admin'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db.insert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'evidence-1', fileName: 'photo.jpg' }]),
      }),
    });
  });

  it('rejects upload when MinIO storage is unavailable', async () => {
    storageService.putObject.mockRejectedValue(new Error('connection refused'));

    await expect(
      service.upload(
        'permit-1',
        {
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('test'),
        },
        {},
        operator,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
