import { ConflictException } from '@nestjs/common';
import { PermitLototoExecutionService } from '../app/src/modules/permit/permit-lototo-execution.service';

describe('LOTOTO work-start and close gates', () => {
  it('allows start when LOTOTO is not required', async () => {
    const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
    (service as unknown as { permitService: { findOne: () => Promise<unknown> } }).permitService = {
      findOne: async () => ({ permit: { id: 'permit-id', lototoRequired: false } }),
    };

    await expect(service.assertIsolationReadyToStart('permit-id', { id: 'user' } as never)).resolves.toBeUndefined();
  });

  it('blocks start until isolation and try-out are verified', async () => {
    const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
    (service as unknown as { permitService: { findOne: () => Promise<unknown> } }).permitService = {
      findOne: async () => ({ permit: { id: 'permit-id', lototoRequired: true } }),
    };
    (service as unknown as { db: { select: () => unknown } }).db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: async () => [],
          }),
        }),
      }),
    };
    service.getBoard = async () =>
      ({ isolated: false }) as Awaited<ReturnType<PermitLototoExecutionService['getBoard']>>;

    await expect(service.assertIsolationReadyToStart('permit-id', { id: 'user' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks issuer verify until restoration is complete', async () => {
    const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
    (service as unknown as { permitService: { findOne: () => Promise<unknown> } }).permitService = {
      findOne: async () => ({ permit: { id: 'permit-id', lototoRequired: true } }),
    };
    (service as unknown as { db: { select: () => unknown } }).db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: async () => [],
          }),
        }),
      }),
    };
    service.getBoard = async () =>
      ({ restored: false }) as Awaited<ReturnType<PermitLototoExecutionService['getBoard']>>;

    await expect(service.assertRestorationComplete('permit-id', { id: 'user' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks close while a linked isolation is not yet isolated', async () => {
    const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
    (service as unknown as { permitService: { findOne: () => Promise<unknown> } }).permitService = {
      findOne: async () => ({ permit: { id: 'permit-id', lototoRequired: true } }),
    };
    (service as unknown as { db: { select: () => unknown } }).db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: async () => [{ certificateNumber: 'EIC-2026-00009', status: 'draft' }],
          }),
        }),
      }),
    };

    await expect(service.assertRestorationComplete('permit-id', { id: 'user' } as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows close when every linked isolation is isolated', async () => {
    const service = Object.create(PermitLototoExecutionService.prototype) as PermitLototoExecutionService;
    (service as unknown as { permitService: { findOne: () => Promise<unknown> } }).permitService = {
      findOne: async () => ({ permit: { id: 'permit-id', lototoRequired: true } }),
    };
    (service as unknown as { db: { select: () => unknown } }).db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: async () => [{ certificateNumber: 'EIC-2026-00009', status: 'isolated_verified' }],
          }),
        }),
      }),
    };

    await expect(service.assertRestorationComplete('permit-id', { id: 'user' } as never)).resolves.toBeUndefined();
  });
});
