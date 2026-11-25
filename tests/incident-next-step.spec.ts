import { INCIDENT_NEXT_STEP } from '../frontend/src/lib/safety/status';
import { buildWorkQueue } from '../frontend/src/lib/work-queue';
import type { Incident } from '../frontend/src/lib/incidents/types';

describe('Incident next step mapping and work queue actions (Issue 328)', () => {
  const baseIncident: Incident = {
    id: 'inc-1',
    tenantId: 'tenant-1',
    reference: 'INC-2026-001',
    title: 'Near miss at scaffold',
    description: 'Dropped tool from scaffold',
    incidentType: 'near_miss',
    severityPath: 'near_miss',
    priority: 'high',
    status: 'pending_hod_decision',
    locationDescription: 'Scaffold area',
    occurredAt: '2026-11-20T10:00:00Z',
    reportedBy: 'user-1',
    submittedAt: '2026-11-20T10:05:00Z',
    plantId: null,
    locationId: null,
    workstationId: null,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
  };

  it('defines non-empty next step fallback text for all incident statuses', () => {
    const statuses = [
      'draft',
      'pending_hod_decision',
      'open',
      'investigating',
      'pending_verification',
      'verified',
      'closed',
    ];

    for (const status of statuses) {
      expect(INCIDENT_NEXT_STEP[status]).toBeDefined();
      expect(typeof INCIDENT_NEXT_STEP[status]).toBe('string');
      expect(INCIDENT_NEXT_STEP[status].trim().length).toBeGreaterThan(0);
    }

    expect(INCIDENT_NEXT_STEP['pending_hod_decision']).toBe('Awaiting Approver decision');
    expect(INCIDENT_NEXT_STEP['investigating']).toBe('Assigned investigator');
  });

  it('Safety officer role sees no personal action for pending_hod_decision, triggering fallback', () => {
    const safetyRoles = ['safety-officer'];
    const items = buildWorkQueue(safetyRoles, [], [], [], [baseIncident]);

    const matchingAction = items.find((item) => item.href === `/incidents/${baseIncident.id}`);
    expect(matchingAction).toBeUndefined();
    // Safety officer table uses fallback text:
    expect(INCIDENT_NEXT_STEP[baseIncident.status]).toBe('Awaiting Approver decision');
  });

  it('Approver / tenant admin roles receive the decide action for pending_hod_decision', () => {
    const approverRoles = ['permit-approver'];
    const items = buildWorkQueue(approverRoles, [], [], [], [baseIncident]);

    const matchingAction = items.find((item) => item.href === `/incidents/${baseIncident.id}`);
    expect(matchingAction).toBeDefined();
    expect(matchingAction?.action).toBe('incident-decision');
    expect(matchingAction?.label).toBe('Decide');
  });

  it('Safety officer role receives assign-investigation action when incident is open', () => {
    const openIncident: Incident = { ...baseIncident, status: 'open' };
    const items = buildWorkQueue(['safety-officer'], [], [], [], [openIncident]);

    const matchingAction = items.find((item) => item.href === `/incidents/${openIncident.id}`);
    expect(matchingAction).toBeDefined();
    expect(matchingAction?.action).toBe('assign-investigation');
    expect(matchingAction?.label).toBe('Assign');
  });

  it('Safety officer role receives verify-incident action with Verify label when incident is pending_verification', () => {
    const pendingVerificationIncident: Incident = { ...baseIncident, status: 'pending_verification' };
    const items = buildWorkQueue(['safety-officer'], [], [], [], [pendingVerificationIncident]);

    const matchingAction = items.find((item) => item.href === `/incidents/${pendingVerificationIncident.id}`);
    expect(matchingAction).toBeDefined();
    expect(matchingAction?.action).toBe('verify-incident');
    expect(matchingAction?.label).toBe('Verify');
  });

  it('determines ActionLink vs fallback text correctly depending on presence of work action', () => {
    // When actionByIncident has an item, action is truthy (ActionLink is rendered)
    const safetyRoles = ['safety-officer'];
    const openIncident: Incident = { ...baseIncident, status: 'open' };
    const itemsWithAction = buildWorkQueue(safetyRoles, [], [], [], [openIncident]);
    const actionByIncident = new Map(
      itemsWithAction
        .filter((i) => !i.permit && i.href.startsWith('/incidents/'))
        .map((i) => [i.href.split('/')[2], i])
    );

    const actionForOpen = actionByIncident.get(openIncident.id);
    expect(actionForOpen).toBeDefined();
    expect(actionForOpen?.label).toBe('Assign');

    // When actionByIncident does NOT have an item (e.g. safety officer on pending_hod_decision), fallback text is rendered
    const pendingIncident: Incident = { ...baseIncident, status: 'pending_hod_decision' };
    const itemsWithoutAction = buildWorkQueue(safetyRoles, [], [], [], [pendingIncident]);
    const actionByIncidentPending = new Map(
      itemsWithoutAction
        .filter((i) => !i.permit && i.href.startsWith('/incidents/'))
        .map((i) => [i.href.split('/')[2], i])
    );

    const actionForPending = actionByIncidentPending.get(pendingIncident.id);
    expect(actionForPending).toBeUndefined();
    // Fallback text is displayed
    const fallbackText = INCIDENT_NEXT_STEP[pendingIncident.status] ?? 'No action needed';
    expect(fallbackText).toBe('Awaiting Approver decision');
  });
});
