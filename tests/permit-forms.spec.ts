import { applyStageAnswers, buildFormResponses, clearStageAnswers, formsToCheck, keepLaterStageAnswers, stagesReopenedBy, diffFormAnswers, missingFormAnswers, sanitizeAnswers } from '../app/src/modules/permit/permit-forms';
import { REFERENCE_TEMPLATES, type TemplateConfig } from '../app/src/modules/organisation/permit-template-library';

const config: TemplateConfig = {
  kind: 'check-sheet',
  sections: [
    {
      id: 's',
      title: 'Checks',
      fields: [
        { id: 'isolated', label: 'Isolated', type: 'check', required: true },
        { id: 'oxygen', label: 'Oxygen', type: 'number', unit: '%', required: true },
        { id: 'fuel', label: 'Fuel', type: 'select', options: ['LPG', 'Acetylene'] },
        { id: 'ppe', label: 'PPE', type: 'multiselect', options: ['Helmet', 'Gloves'] },
        { id: 'issuer', label: 'Issued by', type: 'signature', required: true },
        { id: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
  ],
};

describe('Permit form answers', () => {
  it('keeps valid answers, coerces numbers and drops empty or unknown ones', () => {
    expect(
      sanitizeAnswers(config, {
        isolated: 'yes',
        oxygen: '20.9',
        fuel: 'LPG',
        ppe: ['Helmet', 'Helmet'],
        issuer: { name: ' A. Kumar ', date: '2026-09-27', time: '' },
        notes: '   ',
        stray: 'ignored',
      }),
    ).toEqual({
      isolated: 'yes',
      oxygen: 20.9,
      fuel: 'LPG',
      ppe: ['Helmet'],
      issuer: { name: 'A. Kumar', date: '2026-09-27', time: undefined },
    });
  });

  it('rejects answers that do not fit the field', () => {
    expect(() => sanitizeAnswers(config, { isolated: 'maybe' })).toThrow('Isolated');
    expect(() => sanitizeAnswers(config, { oxygen: 'high' })).toThrow('Oxygen');
    expect(() => sanitizeAnswers(config, { fuel: 'Diesel' })).toThrow('Fuel');
    expect(() => sanitizeAnswers(config, { ppe: ['Boots'] })).toThrow('PPE');
  });

  it('copies the template into each response and refuses unknown templates', () => {
    const templates = [{ id: 't1', name: 'Hot work', config }];
    const [response] = buildFormResponses([{ templateId: 't1', answers: { isolated: 'na' } }], templates);
    expect(response).toEqual({ templateId: 't1', name: 'Hot work', config, answers: { isolated: 'na' } });
    expect(() => buildFormResponses([{ templateId: 'gone', answers: {} }], templates)).toThrow('no longer exists');
  });

  it('lists required answers still missing, per applicable template', () => {
    const templates = [{ id: 't1', name: 'Hot work', config }];
    expect(missingFormAnswers(templates, [])).toEqual(['Hot work: 3 required answers missing (Isolated, Oxygen, Issued by)']);
    const answered = buildFormResponses(
      [{ templateId: 't1', answers: { isolated: 'no', oxygen: 21, issuer: { name: 'B' } } }],
      templates,
    );
    expect(missingFormAnswers(templates, answered)).toEqual([]);
  });

  it('accepts a fully answered reference check sheet', () => {
    const hotWork = REFERENCE_TEMPLATES.find((t) => t.code === 'SOP-ES-023-F4')!;
    const answers: Record<string, unknown> = {};
    for (const field of hotWork.config.sections.flatMap((s) => s.fields)) {
      answers[field.id] =
        field.type === 'check' ? 'yes' : field.type === 'signature' ? { name: 'Tester' } : field.type === 'textarea' ? 'None' : 'x';
    }
    const responses = buildFormResponses([{ templateId: 'hw', answers }], [{ id: 'hw', name: hotWork.name, config: hotWork.config }]);
    expect(missingFormAnswers([{ id: 'hw', name: hotWork.name, config: hotWork.config }], responses)).toEqual([]);
  });
});

describe('diffFormAnswers', () => {
  const response = (answers: Record<string, string | number>) => ({ templateId: 't', name: 'Checks', config, answers });

  it('lists added, changed and cleared answers with their section, and nothing for unchanged ones', () => {
    const changes = diffFormAnswers([response({ isolated: 'no', oxygen: 20.9 })], [response({ isolated: 'yes' })]);
    expect(changes).toEqual([
      { templateId: 't', sectionId: 's', fieldId: 'isolated', from: 'no', to: 'yes' },
      { templateId: 't', sectionId: 's', fieldId: 'oxygen', from: 20.9, to: null },
    ]);
    expect(diffFormAnswers([response({ isolated: 'yes' })], [response({ isolated: 'yes' })])).toEqual([]);
  });

  it('records every answer of a removed form as cleared', () => {
    expect(diffFormAnswers([response({ isolated: 'yes' })], [])).toEqual([
      { templateId: 't', sectionId: 's', fieldId: 'isolated', from: 'yes', to: null },
    ]);
  });
});

describe('required-at stage', () => {
  const staged: TemplateConfig = {
    kind: 'permit',
    sections: [
      {
        id: 'a',
        title: 'Authorisation',
        fields: [
          { id: 'issuer', label: 'Job issued by', type: 'signature', required: true },
          { id: 'hod', label: 'HOD of job issuer', type: 'signature', required: true, requiredAt: 'approval' },
          { id: 'done', label: 'Job completion accepted by', type: 'signature', required: true, requiredAt: 'closure' },
        ],
      },
    ],
  };
  const template = [{ id: 't', name: 'Safe work permit', config: staged }];

  it('submit checks only submit-stage fields (absent stage means submit)', () => {
    expect(missingFormAnswers(template, [])).toEqual(['Safe work permit: 1 required answer missing (Job issued by)']);
    const signed = [{ templateId: 't', name: 'Safe work permit', config: staged, answers: { issuer: { name: 'A' } } }];
    expect(missingFormAnswers(template, signed)).toEqual([]);
  });

  it('a later stage checks only its own fields', () => {
    expect(missingFormAnswers(template, [], 'approval')).toEqual(['Safe work permit: 1 required answer missing (HOD of job issuer)']);
    expect(missingFormAnswers(template, [], 'closure')).toEqual(['Safe work permit: 1 required answer missing (Job completion accepted by)']);
  });

  it('the reference Safe work permit leaves only the issuer signature blocking submission', () => {
    const safe = REFERENCE_TEMPLATES.find((t) => t.name === 'Safe work permit')!;
    const stageOf = (label: string) =>
      safe.config.sections.flatMap((s) => s.fields).find((f) => f.label === label)?.requiredAt ?? 'submit';
    expect(['Job issued by', 'HOD of job issuer', 'Job authorised by', 'Job completion accepted by'].map(stageOf)).toEqual([
      'submit',
      'approval',
      'approval',
      'closure',
    ]);
    const hotWork = REFERENCE_TEMPLATES.find((t) => t.code === 'SOP-ES-023-F4')!;
    const fireWatch = hotWork.config.sections.flatMap((s) => s.fields).find((f) => f.label === 'Fire watch: three hours after completion');
    expect(fireWatch?.requiredAt).toBe('closure');
  });

  it('a stage sets only its own fields, keeps every other answer, and signs as the person deciding', () => {
    const stored = [{ templateId: 't', name: 'Safe work permit', config: staged, answers: { issuer: { name: 'A' } } }];
    const next = applyStageAnswers(
      stored,
      [{ templateId: 't', answers: { issuer: { name: 'Changed' }, hod: { name: 'Someone else', date: '2026-10-01' }, done: { name: 'Too early' } } }],
      template,
      'approval',
      'Hema Rao',
    );
    expect(next[0].answers).toEqual({ issuer: { name: 'A' }, hod: { name: 'Hema Rao', date: '2026-10-01', time: undefined } });
    expect(missingFormAnswers(template, next, 'approval')).toEqual([]);
    // Clearing a stage answer is allowed; the stored permit is never mutated.
    expect(applyStageAnswers(next, [{ templateId: 't', answers: {} }], template, 'approval', 'Hema Rao')[0].answers).toEqual({ issuer: { name: 'A' } });
    expect(stored[0].answers).toEqual({ issuer: { name: 'A' } });
  });

  it('adds a response for an applicable form the permit has none for, and refuses unknown templates', () => {
    expect(applyStageAnswers([], [{ templateId: 't', answers: { done: { name: 'C' } } }], template, 'closure', 'Closer')).toEqual([
      { templateId: 't', name: 'Safe work permit', config: staged, answers: { done: { name: 'Closer', date: undefined, time: undefined } } },
    ]);
    expect(() => applyStageAnswers([], [{ templateId: 'gone', answers: {} }], template, 'closure', 'Closer')).toThrow('no longer exists');
  });

  it('a second approver signing another field leaves the first approver\'s signature exactly as it was', () => {
    const two: TemplateConfig = {
      kind: 'permit',
      sections: [
        {
          id: 'a',
          title: 'Authorisation',
          fields: [
            { id: 'hod', label: 'HOD of job issuer', type: 'signature', required: true, requiredAt: 'approval' },
            { id: 'auth', label: 'Job authorised by', type: 'signature', required: true, requiredAt: 'approval' },
          ],
        },
      ],
    };
    const forms = [{ id: 't', name: 'Safe work permit', config: two }];
    const first = applyStageAnswers([], [{ templateId: 't', answers: { hod: { name: 'Typed', date: '2026-10-01', time: '09:00' } } }], forms, 'approval', 'Hema Rao');
    // The screen sends the HOD's stored signature back together with the authoriser's new one.
    const second = applyStageAnswers(
      first,
      [{ templateId: 't', answers: { hod: { name: 'Hema Rao', date: '2026-10-01', time: '09:00' }, auth: { name: 'Typed', date: '2026-10-01', time: '10:30' } } }],
      forms,
      'approval',
      'Arun Mehta',
    );
    expect(second[0].answers).toEqual({
      hod: { name: 'Hema Rao', date: '2026-10-01', time: '09:00' },
      auth: { name: 'Arun Mehta', date: '2026-10-01', time: '10:30' },
    });
    // Re-signing (a changed time) is a new attestation by whoever does it.
    const resigned = applyStageAnswers(second, [{ templateId: 't', answers: { ...second[0].answers, hod: { name: 'Hema Rao', date: '2026-10-01', time: '11:00' } } }], forms, 'approval', 'Arun Mehta');
    expect(resigned[0].answers.hod).toEqual({ name: 'Arun Mehta', date: '2026-10-01', time: '11:00' });
  });

  it('a draft save never writes approval or closure fields; it keeps what is stored', () => {
    const incoming = [{ templateId: 't', name: 'Safe work permit', config: staged, answers: { issuer: { name: 'I' }, hod: { name: 'Prefilled' }, done: { name: 'Prefilled' } } }];
    expect(keepLaterStageAnswers([], incoming)[0].answers).toEqual({ issuer: { name: 'I' } });
    const stored = [{ ...incoming[0], answers: { hod: { name: 'Signed at approval' } } }];
    expect(keepLaterStageAnswers(stored, incoming)[0].answers).toEqual({ issuer: { name: 'I' }, hod: { name: 'Signed at approval' } });
  });

  it('a new approval round clears approval and closure signatures; a new closure round only closure ones', () => {
    const responses = [{ templateId: 't', name: 'Safe work permit', config: staged, answers: { issuer: { name: 'I' }, hod: { name: 'H' }, done: { name: 'C' } } }];
    expect(clearStageAnswers(responses, stagesReopenedBy('pending_approval'))[0].answers).toEqual({ issuer: { name: 'I' } });
    expect(clearStageAnswers(responses, stagesReopenedBy('execution_completed'))[0].answers).toEqual({ issuer: { name: 'I' }, hod: { name: 'H' } });
    expect(stagesReopenedBy('active')).toEqual([]);
  });

  it('captured forms stay required after their template is archived or no longer applies', () => {
    const captured = [{ templateId: 't', name: 'Safe work permit', config: staged, answers: { issuer: { name: 'I' } } }];
    // The live catalogue no longer lists the template.
    expect(missingFormAnswers(formsToCheck(captured, []), captured, 'approval')).toEqual(['Safe work permit: 1 required answer missing (HOD of job issuer)']);
    // A template that applies now but has no answers yet is still checked.
    expect(formsToCheck([], template).map((t) => t.id)).toEqual(['t']);
  });
});
