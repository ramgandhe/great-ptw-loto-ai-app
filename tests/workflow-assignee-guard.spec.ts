import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { requireActorId } from '../app/src/common/helpers/require-actor-id';
import { WorkflowEngineService } from '../app/src/modules/approval/workflow-engine.service';

describe('requireActorId', () => {
  it('returns a trimmed UUID', () => {
    expect(requireActorId('  11111111-1111-4111-8111-111111111111  ')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('rejects missing ids before workflow insert', () => {
    expect(() => requireActorId(undefined)).toThrow(UnauthorizedException);
    expect(() => requireActorId('')).toThrow(UnauthorizedException);
    expect(() => requireActorId({ id: '', username: 'x', roles: [] })).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects non-UUID ids that would break assignee_id', () => {
    expect(() => requireActorId('not-a-uuid')).toThrow(BadRequestException);
  });
});

describe('WorkflowEngineService.initializeAtSubmit guards', () => {
  it('fails fast when submittedBy is missing instead of hitting Postgres', async () => {
    const engine = new WorkflowEngineService({} as never);

    await expect(
      engine.initializeAtSubmit(
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        undefined as never,
      ),
    ).rejects.toThrow(/submitter user id|Authenticated user id/i);
  });
});
