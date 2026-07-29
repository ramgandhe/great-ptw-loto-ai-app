import { ConflictException } from '@nestjs/common';
import { StatusTransitionService } from '../src/modules/execution/status-transition.service';

describe('StatusTransitionService', () => {
  const service = new StatusTransitionService();

  it.each([
    ['approved', 'active'],
    ['active', 'suspended'],
    ['active', 'pending_closure'],
    ['suspended', 'active'],
  ])('allows %s -> %s', (from, to) => {
    expect(() => service.assertAllowed(from, to)).not.toThrow();
  });

  it.each([
    ['draft', 'active'],
    ['pending_approval', 'active'],
    ['approved', 'closed'],
    ['suspended', 'closed'],
    ['closed', 'active'],
  ])('rejects %s -> %s', (from, to) => {
    expect(() => service.assertAllowed(from, to)).toThrow(ConflictException);
  });
});
