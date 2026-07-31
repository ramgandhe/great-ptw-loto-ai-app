import { PermitLogService } from '../app/src/modules/permit/permit-log.service';

describe('PermitLogService', () => {
  it('emits structured permit events for Loki', () => {
    const service = new PermitLogService();
    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

    service.logEvent({
      action: 'permit.created',
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'permit.event',
        domain: 'permit-to-work',
        module: 'permit-creation',
        loki: true,
        action: 'permit.created',
        permitId: 'permit-1',
      }),
    );
  });
});
