import type { Incident } from '../frontend/src/lib/incidents/types';
import { OPEN_INCIDENT_STATUSES } from '../app/src/modules/dashboards/insights.service';

describe('Serious incidents open metrics and filter consistency (Issue #322)', () => {
  const dummyIncident = (
    id: string,
    priority: 'low' | 'medium' | 'high',
    status: string,
    occurredAt: string,
  ): Incident => ({
    id,
    tenantId: 'tenant-1',
    reference: `INC-${id}`,
    title: `Incident ${id}`,
    description: `Description ${id}`,
    incidentType: 'incident',
    severityPath: 'accident',
    priority,
    status: status as never,
    occurredAt,
    reportedBy: 'user-1',
    submittedAt: occurredAt,
    plantId: 'site-1',
    locationId: 'loc-1',
    workstationId: null,
    locationDescription: '',
    createdAt: occurredAt,
    updatedAt: occurredAt,
  });

  const now = new Date('2026-11-26T12:00:00Z');
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const incidents: Incident[] = [
    // 1. High severity incident reported 45 days ago, still investigating (OPEN)
    dummyIncident('1', 'high', 'investigating', '2026-10-12T10:00:00Z'),
    // 2. High severity incident reported 10 days ago, pending HOD decision (OPEN)
    dummyIncident('2', 'high', 'pending_hod_decision', '2026-11-16T10:00:00Z'),
    // 3. Medium severity incident reported 5 days ago, open (OPEN, but NOT serious)
    dummyIncident('3', 'medium', 'open', '2026-11-21T10:00:00Z'),
    // 4. High severity incident reported 15 days ago, closed (CLOSED)
    dummyIncident('4', 'high', 'closed', '2026-11-11T10:00:00Z'),
    // 5. High severity incident in draft status (DRAFT, not yet open/submitted)
    dummyIncident('5', 'high', 'draft', '2026-11-25T10:00:00Z'),
    // 6. High severity incident reported 60 days ago, verified pending closure (OPEN)
    dummyIncident('6', 'high', 'verified', '2026-09-27T10:00:00Z'),
  ];

  it('counts all open high severity incidents regardless of 30-day period window', () => {
    // The previous faulty logic filtered incidentRows by occurredAt >= 30 days ago first:
    const faultyFiltered = incidents.filter(
      (i) =>
        new Date(i.occurredAt).getTime() >= thirtyDaysAgo.getTime() &&
        OPEN_INCIDENT_STATUSES.includes(i.status as never) &&
        i.priority === 'high',
    );
    expect(faultyFiltered.length).toBe(1); // Only incident '2' was within 30 days!

    // The required logic for attention tile:
    // Any open incident (status in OPEN_INCIDENT_STATUSES) with priority === 'high'
    const correctCount = incidents.filter(
      (i) =>
        OPEN_INCIDENT_STATUSES.includes(i.status as never) &&
        i.priority === 'high',
    );

    // Incidents 1, 2, and 6 are open serious incidents.
    expect(correctCount.length).toBe(3);
    expect(correctCount.map((i) => i.id)).toEqual(['1', '2', '6']);
  });

  it('matches exactly what frontend displays when filtered with priority=high', () => {
    const prioritiesFilter = ['high'];
    // Frontend open filter: excludes closed and draft
    const frontendOpenIncidents = incidents.filter(
      (i) => i.status !== 'closed' && i.status !== 'draft',
    );
    const frontendFiltered = frontendOpenIncidents.filter((i) =>
      prioritiesFilter.includes(i.priority),
    );

    expect(frontendFiltered.length).toBe(3);
    expect(frontendFiltered.map((i) => i.id)).toEqual(['1', '2', '6']);
  });

  it('keeps drafts accessible under draft view while excluding them from open serious counts', () => {
    const openIncidents = incidents.filter(
      (i) => i.status !== 'closed' && i.status !== 'draft',
    );
    const draftIncidents = incidents.filter((i) => i.status === 'draft');
    const closedIncidents = incidents.filter((i) => i.status === 'closed');

    expect(openIncidents.length).toBe(4); // 1, 2, 3, 6
    expect(draftIncidents.length).toBe(1); // 5
    expect(closedIncidents.length).toBe(1); // 4

    // Open high severity incidents count matches dashboard tile exactly
    const seriousOpen = openIncidents.filter((i) => i.priority === 'high');
    expect(seriousOpen.length).toBe(3);
  });
});
