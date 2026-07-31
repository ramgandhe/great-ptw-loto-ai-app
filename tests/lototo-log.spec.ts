import { LototoLogService } from '../app/src/modules/lototo/lototo-log.service';

describe('LototoLogService (PUS-155)', () => {
  it('emits structured LOTOTO events for Loki', () => {
    const service = new LototoLogService();
    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

    service.logEvent({
      action: 'lototo.plan.created',
      planId: 'plan-1',
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'lototo.event',
        domain: 'lock-out-tag-out',
        module: 'lototo-configuration',
        loki: true,
        action: 'lototo.plan.created',
        planId: 'plan-1',
        permitId: 'permit-1',
      }),
    );
  });
});
