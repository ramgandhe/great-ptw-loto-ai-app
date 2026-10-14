import {
  nextHandoffTarget,
  parseDraftHolder,
  returnHandoffTarget,
} from '../app/src/modules/permit/permit-draft-handoff';
import { handoffSectionFor, returnSectionFor } from '../frontend/src/lib/permit/handoff';

describe('permit draft handoff', () => {
  it('moves receiver to operator, then safety officer or review', () => {
    expect(nextHandoffTarget('receiver', true)).toBe('operator');
    expect(nextHandoffTarget('operator', true)).toBe('safety_officer');
    expect(nextHandoffTarget('operator', false)).toBe('ready_for_review');
    expect(nextHandoffTarget('safety_officer', true)).toBe('ready_for_review');
    expect(nextHandoffTarget('ready_for_review', true)).toBeNull();
  });

  it('returns to the previous holder', () => {
    expect(returnHandoffTarget('operator', false)).toBe('receiver');
    expect(returnHandoffTarget('safety_officer', true)).toBe('operator');
    expect(returnHandoffTarget('ready_for_review', true)).toBe('safety_officer');
    expect(returnHandoffTarget('ready_for_review', false)).toBe('operator');
    expect(returnHandoffTarget('receiver', false)).toBeNull();
  });

  it('treats unknown holder as receiver', () => {
    expect(parseDraftHolder(undefined)).toBe('receiver');
    expect(parseDraftHolder('nope')).toBe('receiver');
  });

  it('shows handoff at the end of a role and return at the start', () => {
    expect(handoffSectionFor('receiver')).toBe('place');
    expect(handoffSectionFor('operator')).toBe('forms');
    expect(handoffSectionFor('safety_officer')).toBe('safety');
    expect(returnSectionFor('operator')).toBe('site');
    expect(returnSectionFor('safety_officer')).toBe('safety');
    expect(returnSectionFor('ready_for_review')).toBe('review');
    expect(returnSectionFor('receiver')).toBeNull();
  });
});
