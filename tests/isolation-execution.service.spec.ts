import { ConflictException } from '@nestjs/common';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { IsolationExecutionController } from '../app/src/modules/isolation-execution/isolation-execution.controller';
import { LockController } from '../app/src/modules/isolation-execution/lock.controller';
import { VerificationController } from '../app/src/modules/isolation-execution/verification.controller';
import { StatusValidationService } from '../app/src/modules/isolation-execution/status-validation.service';

describe('StatusValidationService transitions (PUS-156)', () => {
  const svc = new StatusValidationService({} as never);

  it('allows only the legal forward transitions', () => {
    expect(() => svc.assertTransition('in_progress', 'isolated')).not.toThrow();
    expect(() => svc.assertTransition('isolated', 'verified')).not.toThrow();
    expect(() => svc.assertTransition('verified', 'restored')).not.toThrow();
  });

  it('rejects illegal transitions', () => {
    expect(() => svc.assertTransition('in_progress', 'verified')).toThrow(ConflictException);
    expect(() => svc.assertTransition('isolated', 'in_progress')).toThrow(ConflictException);
    expect(() => svc.assertTransition('verified', 'isolated')).toThrow(ConflictException);
    expect(() => svc.assertTransition('restored', 'verified')).toThrow(ConflictException);
  });

  it('enforces editable/verifiable status windows', () => {
    expect(() => svc.assertExecutionEditable('in_progress')).not.toThrow();
    expect(() => svc.assertExecutionEditable('isolated')).toThrow(ConflictException);
    expect(() => svc.assertReadyForVerification('isolated')).not.toThrow();
    expect(() => svc.assertReadyForVerification('in_progress')).toThrow(ConflictException);
    expect(() => svc.assertVerifiable('in_progress')).not.toThrow();
    expect(() => svc.assertVerifiable('isolated')).not.toThrow();
    expect(() => svc.assertVerifiable('verified')).toThrow(ConflictException);
  });
});

describe('Isolation execution controllers are thin (PUS-156)', () => {
  const user: AuthenticatedUser = { id: 'u1', username: 'u', roles: ['isolation-officer'], tenantId: 't1' };

  it('IsolationExecutionController delegates to the service without logic', async () => {
    const service = {
      start: jest.fn().mockResolvedValue({ id: 'e1' }),
      getForPlan: jest.fn().mockResolvedValue({ execution: { id: 'e1' } }),
      markIsolated: jest.fn().mockResolvedValue({ status: 'isolated' }),
      markVerified: jest.fn().mockResolvedValue({ status: 'verified' }),
      captureEvidence: jest.fn().mockResolvedValue({ id: 'ev1' }),
      getDetail: jest.fn().mockResolvedValue({ execution: { id: 'e1' } }),
    };
    const controller = new IsolationExecutionController(service as never);

    await expect(controller.start('p1', user)).resolves.toEqual({ id: 'e1' });
    expect(service.start).toHaveBeenCalledWith('p1', user);

    await controller.isolate('e1', user);
    expect(service.markIsolated).toHaveBeenCalledWith('e1', user);

    await controller.captureEvidence('e1', { fileName: 'a', contentType: 'image/png', fileSize: 1, storageKey: 'k' } as never, user);
    expect(service.captureEvidence).toHaveBeenCalled();
  });

  it('Lock/Verification controllers delegate to their services', async () => {
    const lockService = { apply: jest.fn().mockResolvedValue({ id: 'l1' }) };
    const lockController = new LockController(lockService as never);
    await lockController.apply('e1', { isolationPointId: 'p', lockTag: 't', lockMethod: 'm' } as never, user);
    expect(lockService.apply).toHaveBeenCalledWith('e1', expect.any(Object), user);

    const verificationService = { record: jest.fn().mockResolvedValue({ id: 'v1' }) };
    const verificationController = new VerificationController(verificationService as never);
    await verificationController.record('e1', { isolationPointId: 'p', result: 'pass' } as never, user);
    expect(verificationService.record).toHaveBeenCalledWith('e1', expect.any(Object), user);
  });
});
