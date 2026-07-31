import { ExecutionLogService } from '../app/src/modules/execution/execution-log.service';

describe('ExecutionLogService (PUS-145)', () => {
  const service = new ExecutionLogService();

  it('emits structured Loki-friendly execution events', () => {
    const logSpy = jest.spyOn(service['logger'], 'log');

    service.logEvent({
      action: 'execution.activated',
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'execution.event',
        domain: 'permit-to-work',
        module: 'permit-execution',
        loki: true,
        action: 'execution.activated',
      }),
    );
  });
});
