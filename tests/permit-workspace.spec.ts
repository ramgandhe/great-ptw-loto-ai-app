import { inQueueView, queueViewFrom } from '../frontend/src/lib/permit/queue-views';
import { workspaceHref, workspaceTabs } from '../frontend/src/lib/permit/workspace-tabs';
import { buildWorkQueue } from '../frontend/src/lib/work-queue';
import type { PermitRecord } from '../frontend/src/lib/permit/types';

describe('permit workspace (S4)', () => {
  it('offers only the tabs that have something for the person and the status', () => {
    expect(workspaceTabs('draft', ['job-issuer'])).toEqual(['overview', 'preparation', 'history']);
    expect(workspaceTabs('pending_approval', ['hod'])).toEqual(['overview', 'preparation', 'review', 'history']);
    // Operators cannot read approvals, but closure review (evidence, verification) is open to them.
    expect(workspaceTabs('pending_approval', ['operator'])).toEqual(['overview', 'preparation', 'history']);
    expect(workspaceTabs('active', ['operator'])).toEqual(['overview', 'preparation', 'work', 'history']);
    expect(workspaceTabs('pending_closure', ['operator'])).toEqual(['overview', 'preparation', 'review', 'history']);
    expect(workspaceTabs('active', ['safety-officer'])).not.toContain('work');
  });

  it('links to a tab, with the overview at the plain permit URL', () => {
    expect(workspaceHref('p1')).toBe('/permits/p1');
    expect(workspaceHref('p1', 'review')).toBe('/permits/p1?tab=review');
  });

  it('sends queue items to the workspace tab that does the job; editing stays in the editor', () => {
    const permit = (id: string, status: string) => ({ id, status, title: id, permitTypeId: 't', updatedAt: '', createdAt: '' }) as unknown as PermitRecord;
    const hrefs = Object.fromEntries(
      buildWorkQueue(['job-issuer', 'hod', 'operator'], [permit('d', 'draft'), permit('a', 'active'), permit('c', 'pending_closure')], [
        { permit: permit('r', 'pending_approval') } as never,
      ]).map((item) => [item.key, item.href]),
    );
    expect(hrefs).toMatchObject({
      'review:r': '/permits/r?tab=review',
      'finish-draft:d': '/permits/d/edit',
      'log-progress:a': '/permits/a?tab=work',
      'final-approval:c': '/permits/c?tab=review',
    });
  });
});

describe('permit queue views (S4)', () => {
  const params = (query: string) => new URLSearchParams(query);

  it('starts on Needs me when work is waiting, otherwise All; explicit and legacy links win', () => {
    expect(queueViewFrom(params(''), 2)).toBe('needs-me');
    expect(queueViewFrom(params(''), 0)).toBe('all');
    expect(queueViewFrom(params('view=closing'), 2)).toBe('closing');
    expect(queueViewFrom(params('scope=mine'), 0)).toBe('needs-me');
    expect(queueViewFrom(params('stage=done'), 2)).toBe('finished');
    expect(queueViewFrom(params('view=nonsense'), 0)).toBe('all');
  });

  it('places every status in exactly one stage view', () => {
    const statuses = ['draft', 'pending_approval', 'deferred', 'rejected', 'approved', 'active', 'suspended', 'execution_completed', 'pending_closure', 'closed', 'cancelled', 'expired'];
    for (const status of statuses) {
      const views = (['drafts', 'review', 'live', 'closing', 'finished'] as const).filter((view) => inQueueView(view, status, false));
      expect([status, views.length]).toEqual([status, 1]);
      expect(inQueueView('all', status, false)).toBe(true);
    }
    expect(inQueueView('needs-me', 'active', true)).toBe(true);
    expect(inQueueView('needs-me', 'active', false)).toBe(false);
  });
});
