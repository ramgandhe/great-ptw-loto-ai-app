import { ForbiddenException } from '@nestjs/common';
import { ApprovalAttachmentService } from '../app/src/modules/approval/approval-attachment.service';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';

describe('ApprovalAttachmentService (PUS-140)', () => {
  const db = {
    select: jest.fn(),
  };

  const storageService = {
    presignedGetObject: jest.fn().mockResolvedValue('https://minio.example/permit.pdf'),
  };

  const configService = {
    get: jest.fn().mockReturnValue(3600),
  };

  const service = new ApprovalAttachmentService(
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

  it('denies attachment access for users without approval read roles', async () => {
    const unauthorized: AuthenticatedUser = {
      ...viewer,
      roles: ['job-issuer'],
    };

    await expect(
      service.getDownloadUrl('permit-1', 'attachment-1', unauthorized),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns presigned download url for authorised reviewers', async () => {
    const permit = {
      id: 'permit-1',
      tenantId: 'tenant-1',
      status: 'pending_approval',
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
});
