import { BadRequestException, Injectable } from '@nestjs/common';
import type { PermitStatus } from '../../database/schema';

/** Allowed permit status transitions (FR-PTW-030). */
const ALLOWED_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft: ['pending_approval', 'rejected'],
  pending_approval: ['pending_approval', 'approved', 'rejected', 'deferred'],
  deferred: ['pending_approval', 'rejected'],
  rejected: ['pending_approval', 'draft'],
  approved: ['active', 'rejected'],
  active: ['suspended', 'pending_closure', 'closed', 'rejected'],
  suspended: ['active', 'rejected'],
  pending_closure: ['closed'],
  expired: ['draft'],
  closed: [],
};

@Injectable()
export class PermitLifecycleService {
  assertTransition(fromStatus: string, toStatus: string): void {
    const allowed = ALLOWED_TRANSITIONS[fromStatus];
    if (!allowed) {
      throw new BadRequestException(`Unknown permit status: ${fromStatus}`);
    }

    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid permit transition: ${fromStatus} -> ${toStatus}. Direct shortcuts are not permitted.`,
      );
    }
  }

  canTransition(fromStatus: string, toStatus: PermitStatus | string): boolean {
    const allowed = ALLOWED_TRANSITIONS[fromStatus];
    return Boolean(allowed?.includes(toStatus));
  }
}
