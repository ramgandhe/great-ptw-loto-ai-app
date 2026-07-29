import { ClosureLogService } from '../src/modules/closure/closure-log.service';

describe('ClosureLogService (PUS-150)', () => {
  const service = new ClosureLogService();

  it('emits structured Loki-friendly closure events', () => {
    const logSpy = jest.spyOn(service['logger'], 'log');

    service.logEvent({
      action: 'closure.closed',
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'closure.event',
        domain: 'permit-to-work',
        module: 'permit-closure',
        loki: true,
        action: 'closure.closed',
      }),
    );
  });
});
