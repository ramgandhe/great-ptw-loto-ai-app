import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns a non-empty UUID actor id or throws. */
export function requireActorId(
  userOrId: AuthenticatedUser | string | null | undefined,
  message = 'Authenticated user id is required',
): string {
  const id = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new UnauthorizedException(message);
  }
  const trimmed = id.trim();
  if (!UUID_RE.test(trimmed)) {
    throw new BadRequestException(
      'User id must be a UUID to record multi-day permit activity.',
    );
  }
  return trimmed;
}
