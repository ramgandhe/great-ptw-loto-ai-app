import { ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../app/src/common/interfaces/authenticated-user.interface';

let currentUser: AuthenticatedUser | undefined;

export function setIntegrationUser(user: AuthenticatedUser): void {
  currentUser = user;
}

export function getIntegrationUser(): AuthenticatedUser | undefined {
  return currentUser;
}

export function createIntegrationAuthGuard() {
  return {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
      if (currentUser) {
        request.user = currentUser;
      }
      return true;
    },
  };
}

export async function asIntegrationUser<T>(
  user: AuthenticatedUser,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = currentUser;
  setIntegrationUser(user);
  try {
    return await fn();
  } finally {
    if (previous) {
      setIntegrationUser(previous);
    } else {
      currentUser = undefined;
    }
  }
}
