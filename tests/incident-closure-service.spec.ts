import { ConflictException, ForbiddenException } from '@nestjs/common';
import { IncidentClosureService } from '../app/src/modules/incident-closure/incident-closure.service';

describe('IncidentClosureService (PUS-196)', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'manager',
    roles: ['safety-officer'],
    tenantId,
  };
  const incidentId = '33333333-3333-4333-8333-333333333333';

  function buildService(incidentStatus: string) {
    const incident = {
      id: incidentId,
      tenantId,
      status: incidentStatus,
      reference: 'INC-1',
      incidentType: 'incident',
      title: 'Title',
    };

    let selectCall = 0;
    const db = {
      select: jest.fn().mockImplementation(() => {
        selectCall += 1;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => chain;
        chain.orderBy = () => Promise.resolve([]);
        chain.limit = () => {
          if (selectCall === 1) {
            return Promise.resolve([incident]);
          }
          return Promise.resolve([]);
        };
        return chain;
      }),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const service = new IncidentClosureService(
      db as never,
      { log: jest.fn() } as never,
      {
        getArchiveList: jest.fn(),
        setArchiveList: jest.fn(),
        getArchiveDetail: jest.fn(),
        setArchiveDetail: jest.fn(),
        invalidateArchive: jest.fn(),
      } as never,
      { invalidateIncident: jest.fn() } as never,
      { invalidate: jest.fn() } as never,
      { logEvent: jest.fn() } as never,
    );

    return { service };
  }

  it('rejects close when incident is not verified', async () => {
    const { service } = buildService('investigating');
    await expect(service.close(incidentId, {}, user)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects verify without tenant', async () => {
    const { service } = buildService('investigating');
    await expect(
      service.verify(
        incidentId,
        { correctiveActionsConfirmed: true, preventiveActionsReviewed: true },
        { ...user, tenantId: undefined },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
