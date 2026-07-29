import { ApprovalLogService } from '../src/modules/approval/approval-log.service';

describe('ApprovalLogService (PUS-140)', () => {
  it('emits structured approval events for Loki', () => {
    const service = new ApprovalLogService();
    const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

    service.logEvent({
      action: 'approval.approved',
      permitId: 'permit-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'approval.event',
        domain: 'permit-to-work',
        module: 'permit-approval',
        loki: true,
        action: 'approval.approved',
        permitId: 'permit-1',
      }),
    );
  });
});
