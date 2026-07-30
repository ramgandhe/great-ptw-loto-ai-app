import { ForbiddenException } from '@nestjs/common';
import { ClosureAttachmentService } from '../app/src/modules/closure/closure-attachment.service';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';

describe('ClosureAttachmentService (PUS-150)', () => {
  const db = {
    select: jest.fn(),
  };

  const storageService = {
    presignedGetObject: jest.fn().mockResolvedValue('https://minio.example/archive.pdf'),
  };

  const configService = {
    get: jest.fn().mockReturnValue(3600),
  };

  const service = new ClosureAttachmentService(
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

  it('denies attachment download for users without archive read roles', async () => {
    const unauthorized: AuthenticatedUser = {
      ...viewer,
      roles: ['operator'],
    };

    await expect(
      service.getDownloadUrl('permit-1', 'attachment-1', unauthorized),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns presigned download url for closed permit attachments', async () => {
    const permit = {
      id: 'permit-1',
      tenantId: 'tenant-1',
      status: 'closed',
    };
    const attachment = {
      id: 'attachment-1',
      permitId: 'permit-1',
      storageKey: 'tenant-1/permit-1/file.pdf',
    };

    const permitSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([permit]),
    };
    const attachmentSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([attachment]),
    };

    db.select = jest
      .fn()
      .mockReturnValueOnce(permitSelect)
      .mockReturnValueOnce(attachmentSelect);

    const result = await service.getDownloadUrl('permit-1', 'attachment-1', viewer);

    expect(storageService.presignedGetObject).toHaveBeenCalledWith(
      'tenant-1/permit-1/file.pdf',
      3600,
    );
    expect(result.url).toContain('minio.example');
    expect(result.expiresInSeconds).toBe(3600);
  });

  it('denies attachment download for non-closed permits', async () => {
    const permit = {
      id: 'permit-1',
      tenantId: 'tenant-1',
      status: 'active',
    };

    const permitSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([permit]),
    };

    db.select = jest.fn().mockReturnValueOnce(permitSelect);

    await expect(
      service.getDownloadUrl('permit-1', 'attachment-1', viewer),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
