import {
  PERMIT_REPORT_PRIOR_APPROVAL_STATUSES,
  PERMIT_REPORT_ROLES,
  PERMIT_REPORT_SECTIONS,
  PERMIT_REPORT_SIGNATURE_ACTIONS,
  PERMIT_REPORT_STATUSES,
  canGeneratePermitReport,
  isPermitReportSignature,
  permitReportEdition,
  permitReportEditionLabel,
} from '../app/src/modules/permit/permit-report.policy';
import {
  PERMIT_REPORT_PRIOR_APPROVAL_STATUSES as UI_PRIOR,
  PERMIT_REPORT_ROLES as UI_ROLES,
  PERMIT_REPORT_STATUSES as UI_STATUSES,
  canGeneratePermitReport as uiCanGenerate,
  permitReportEditionLabel as uiEditionLabel,
} from '../frontend/src/lib/permit/report-policy';

const REPORT_ROLE = ['permit-receiver'];

describe('permit report policy', () => {
  it('keeps the web rules aligned with the API rules', () => {
    expect(UI_ROLES).toEqual(PERMIT_REPORT_ROLES);
    expect(UI_STATUSES).toEqual(PERMIT_REPORT_STATUSES);
    expect(UI_PRIOR).toEqual(PERMIT_REPORT_PRIOR_APPROVAL_STATUSES);
  });

  it('allows the agreed roles and refuses a viewer', () => {
    for (const role of PERMIT_REPORT_ROLES) {
      expect(canGeneratePermitReport({ status: 'approved', roles: [role], previouslyApproved: true })).toBe(true);
    }
    expect(canGeneratePermitReport({ status: 'approved', roles: ['viewer'], previouslyApproved: true })).toBe(false);
    expect(canGeneratePermitReport({ status: 'closed', roles: [], previouslyApproved: true })).toBe(false);
  });

  it('allows every post-approval status, including expiry and cancellation', () => {
    for (const status of PERMIT_REPORT_STATUSES) {
      expect(canGeneratePermitReport({ status, roles: REPORT_ROLE, previouslyApproved: false })).toBe(true);
    }
  });

  it('allows a return to approval only after the permit was approved', () => {
    for (const status of PERMIT_REPORT_PRIOR_APPROVAL_STATUSES) {
      expect(canGeneratePermitReport({ status, roles: REPORT_ROLE, previouslyApproved: false })).toBe(false);
      expect(canGeneratePermitReport({ status, roles: REPORT_ROLE, previouslyApproved: true })).toBe(true);
    }
  });

  it('never offers a report for a draft', () => {
    expect(canGeneratePermitReport({ status: 'draft', roles: REPORT_ROLE, previouslyApproved: false })).toBe(false);
    expect(uiCanGenerate({ status: 'draft', roles: REPORT_ROLE, previouslyApproved: true })).toBe(false);
  });

  it('marks only a closed permit as final', () => {
    expect(permitReportEdition('closed')).toBe('final');
    expect(permitReportEditionLabel('closed')).toBe('FINAL');
    expect(permitReportEdition('active')).toBe('interim');
    expect(permitReportEditionLabel('active')).toBe('INTERIM');
    expect(permitReportEditionLabel('expired')).toBe('INTERIM — EXPIRED');
    expect(permitReportEditionLabel('cancelled')).toBe('INTERIM — CANCELLED');
    expect(uiEditionLabel('expired')).toBe('INTERIM — EXPIRED');
  });

  it('lists the dossier in reading order and treats decisions as signatures', () => {
    expect(PERMIT_REPORT_SECTIONS.map((section) => section.id)[0]).toBe('cover');
    expect(PERMIT_REPORT_SECTIONS.map((section) => section.id).at(-1)).toBe('audit');
    expect(isPermitReportSignature('approved')).toBe(true);
    expect(isPermitReportSignature('closed')).toBe(true);
    for (const action of ['submitted', 'rejected', 'suspended', 'commented']) {
      expect(PERMIT_REPORT_SIGNATURE_ACTIONS).not.toContain(action);
      expect(isPermitReportSignature(action)).toBe(false);
    }
  });
});
