import { BadRequestException } from '@nestjs/common';
import { PermitLifecycleService } from '../app/src/modules/permit/permit-lifecycle.service';

describe('PermitLifecycleService (PUS-243 / FR-PTW-030)', () => {
  const service = new PermitLifecycleService();

  it('allows draft -> pending_approval', () => {
    expect(() => service.assertTransition('draft', 'pending_approval')).not.toThrow();
  });

  it('allows approved -> active', () => {
    expect(() => service.assertTransition('approved', 'active')).not.toThrow();
  });

  it('blocks direct draft -> active', () => {
    expect(() => service.assertTransition('draft', 'active')).toThrow(BadRequestException);
  });

  it('blocks direct draft -> closed', () => {
    expect(() => service.assertTransition('draft', 'closed')).toThrow(BadRequestException);
  });

  it('allows safety-officer veto from approved -> rejected', () => {
    expect(() => service.assertTransition('approved', 'rejected')).not.toThrow();
  });

  it('blocks closed -> any transition', () => {
    expect(() => service.assertTransition('closed', 'draft')).toThrow(BadRequestException);
  });
});
