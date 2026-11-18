import { assemblePermitReport, type PermitReportSnapshot } from '../app/src/modules/permit/permit-report.assemble';

const approver = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';

function snapshot(overrides: Partial<PermitReportSnapshot> = {}): PermitReportSnapshot {
  return {
    generatedAt: new Date('2026-11-17T10:40:00.000Z'),
    organisation: { name: 'Harbour Works', legalName: 'Harbour Works Pvt Ltd', timezone: 'Asia/Kolkata' },
    siteName: 'Tank farm',
    permitTypeName: 'Hot work',
    permit: {
      id: 'permit-1',
      reference: 'PTW-2026-0012',
      title: 'Hot work on tank roof',
      status: 'active',
      permitVersion: 2,
      workScope: 'Weld the roof patch',
      plannedStartAt: '2026-11-17T03:30:00.000Z',
      plannedEndAt: '2026-11-17T11:30:00.000Z',
      lototoRequired: true,
      approvedBy: approver,
      approvedSignedName: 'Asha Menon',
      formResponses: [{ name: 'Hot work checklist', answers: { 'Fire watch': 'Named', blank: '' } }],
    },
    people: [{ id: approver, name: 'Asha Menon', role: 'permit-approver' }],
    hazards: [{ name: 'Hot surface', controls: ['Fire blanket'] }],
    ppe: [{ name: 'Face shield', quantity: 2 }],
    gasTesting: [{ parameter: 'LEL', unit: '%', minimum: 0, maximum: 10 }],
    isolations: [{ number: 'IC-4', title: 'Tank inlet', status: 'isolated_verified' }],
    multiDay: false,
    execution: { activatedAt: '2026-11-17T04:00:00.000Z', actualStartAt: '2026-11-17T04:05:00.000Z', workState: 'in_progress' },
    attachments: [
      { fileName: 'site.jpg', contentType: 'image/jpeg', fileSize: 1200, uploadedBy: approver, uploadedAt: '2026-11-17T10:40:00.000Z' },
      { fileName: 'method.pdf', contentType: 'application/pdf', fileSize: 4000 },
    ],
    history: [
      { id: 'a', at: '2026-11-17T03:00:00.000Z', action: 'approved', actorId: approver, toStatus: 'approved', comment: 'Site accepted' },
      { id: 'a-copy', at: '2026-11-17T03:00:00.000Z', action: 'approved', actorId: approver, toStatus: 'approved', comment: 'Site accepted' },
      { id: 'b', at: '2026-11-17T04:00:00.000Z', action: 'activated', actorId: stranger, toStatus: 'active' },
    ],
    ...overrides,
  };
}

describe('permit report assembly', () => {
  it('builds an interim dossier with named signatures and dynamic sections', () => {
    const report = assemblePermitReport(snapshot());
    expect(report.editionLabel).toBe('INTERIM');
    expect(report.timezone).toBe('Asia/Kolkata');
    expect(report.permit).toMatchObject({
      reference: 'PTW-2026-0012',
      type: 'Hot work',
      statusLabel: 'Work in progress',
      version: 2,
    });
    expect(report.permit.plannedStart).toContain('Asia/Kolkata');
    expect(report.organisation.site).toBe('Tank farm');
    expect(report.history).toHaveLength(2);
    expect(report.history[0]).toMatchObject({ action: 'approved', actor: 'Asha Menon', signature: true });
    expect(report.history[1]).toMatchObject({ action: 'activated', actor: 'Unknown user', signature: false });
    expect(report.sections).toEqual([
      'cover',
      'summary',
      'scope',
      'people',
      'hazards',
      'controls',
      'forms',
      'gas_testing',
      'lototo',
      'approvals',
      'execution',
      'evidence',
      'history',
      'audit',
    ]);
    expect(report.forms[0].answers).toEqual([{ label: 'Fire watch', value: 'Named' }]);
    expect(report.attachments.map((file) => file.image)).toEqual([true, false]);
    expect(report.attachments[0].uploadedBy).toBe('Asha Menon');
    expect(report.attachments[0].uploadedAt).toContain('Asia/Kolkata');
    expect(report.attachments[1].uploadedBy).toBeNull();
    expect(report.execution?.workState).toBe('in_progress');
    expect(report.simops).toEqual([]);
    expect(report.days).toEqual([]);
    expect(report.sections).not.toContain('simops');
  });

  it('includes a SIMOPS case and the day records', () => {
    const report = assemblePermitReport(snapshot({
      multiDay: true,
      simops: [{
        kind: 'case',
        summary: 'Hot work beside painting',
        severity: 'high',
        status: 'review_required',
        detectedAt: '2026-11-17T03:00:00.000Z',
        decision: 'allow_with_controls',
        comments: 'Keep a fire watch',
        otherPermits: ['PTW-2026-0099 · Painting'],
        controls: [{ text: 'Fire watch on the boundary', userId: approver }],
      }],
      dayRecords: {
        progress: [{ date: '2026-11-17', status: 'submitted', summary: 'Roof patch fitted', recordedBy: approver }],
        handovers: [{ at: '2026-11-17T12:30:00.000Z', fromId: approver, toId: stranger, status: 'accepted' }],
        secures: [{ date: '2026-11-17', status: 'submitted', late: true, securedBy: approver }],
        reopens: [{ date: '2026-11-18', outcome: 'passed', findings: 'Area clear', by: approver }],
      },
    }));
    expect(report.sections).toEqual(expect.arrayContaining(['simops', 'multi_day']));
    expect(report.simops[0]).toMatchObject({
      detail: 'Decision: allow with controls',
      otherPermits: ['PTW-2026-0099 · Painting'],
      controls: ['Fire watch on the boundary · Asha Menon'],
    });
    expect(report.simops[0].detectedAt).toContain('Asia/Kolkata');
    expect(report.days.map((day) => day.date)).toEqual(['2026-11-17', '2026-11-18']);
    expect(report.days[0].progress).toBe('submitted: Roof patch fitted · Asha Menon');
    expect(report.days[0].handovers[0]).toContain('Asha Menon to Unknown user');
    expect(report.days[0].handovers[0]).toContain('accepted');
    expect(report.days[0].secure).toBe('submitted · late · Asha Menon');
    expect(report.days[1].reopen).toBe('passed · Area clear · Asha Menon');
  });

  it('marks a closed permit final and keeps the closure record', () => {
    const report = assemblePermitReport(snapshot({
      permit: { ...snapshot().permit, status: 'closed' },
      closure: { at: '2026-11-17T12:00:00.000Z', actorId: approver, comment: 'Area clear' },
    }));
    expect(report.editionLabel).toBe('FINAL');
    expect(report.closure).toMatchObject({ actor: 'Asha Menon', comment: 'Area clear' });
    expect(report.sections).toContain('closure');
  });
});
