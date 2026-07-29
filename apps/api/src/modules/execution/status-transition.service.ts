import { ConflictException, Injectable } from '@nestjs/common';

const EXECUTION_TRANSITIONS: Record<string, readonly string[]> = {
  approved: ['active'],
  active: ['suspended', 'pending_closure'],
  suspended: ['active'],
};

@Injectable()
export class StatusTransitionService {
  assertAllowed(fromStatus: string, toStatus: string): void {
    if (!EXECUTION_TRANSITIONS[fromStatus]?.includes(toStatus)) {
      throw new ConflictException(
        `Permit cannot transition from ${fromStatus} to ${toStatus}`,
      );
    }
  }
}
