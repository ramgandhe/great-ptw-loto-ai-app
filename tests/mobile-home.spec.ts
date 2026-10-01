import { buildWorkQueue } from '../mobile/src/lib/work-queue';
import { stageAnswersLeft, stageAnswersPayload } from '../mobile/src/lib/permit/forms';
import type { PermitRecord } from '../mobile/src/lib/permit/types';

const permit = (id: string, status: string) => ({ id, status, title: id }) as PermitRecord;

describe('mobile Needs you (S6)', () => {
  it('sends each person to the screen that does their job, with the web app\'s verbs', () => {
    const items = buildWorkQueue(['job-issuer'], [permit('d', 'draft'), permit('x', 'rejected'), permit('c', 'execution_completed')], [
      { permit: permit('r', 'pending_approval') } as never,
    ]);
    expect(items.map((i) => [i.action, i.href])).toEqual([
      ['revise', '/permits/x/edit'],
      ['review', '/approvals/r'],
      ['approve-completion', '/closure/c'],
      ['finish-draft', '/permits/d/edit'],
    ]);
    const operator = buildWorkQueue(['operator'], [permit('d', 'draft'), permit('a', 'active')], []);
    expect(operator.map((i) => i.action)).toEqual(['log-progress', 'site-details']);
    expect(buildWorkQueue(['viewer'], [permit('d', 'draft')], [])).toEqual([]);
  });
});

describe('mobile approval and closure signatures (S6)', () => {
  const config = {
    kind: 'permit' as const,
    sections: [{ id: 'a', title: 'A', fields: [{ id: 'hod', label: 'HOD', type: 'signature' as const, required: true, requiredAt: 'approval' as const }] }],
  };
  const responses = [{ templateId: 't', name: 'Safe work permit', config, answers: {} }];

  it('counts what is left to sign and sends only edited forms, with the revision', () => {
    expect(stageAnswersLeft(responses, 'approval', {})).toBe(1);
    expect(stageAnswersLeft(responses, 'approval', { t: { hod: { name: 'H' } } })).toBe(0);
    expect(stageAnswersLeft(responses, 'closure', {})).toBe(0);
    expect(stageAnswersPayload({}, 3)).toBeUndefined();
    expect(stageAnswersPayload({ t: { hod: { name: 'H' } } }, 3)).toEqual({ expectedRevision: 3, formResponses: [{ templateId: 't', answers: { hod: { name: 'H' } } }] });
  });
});
