import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AUTHENTICATED_KEY = 'authenticated';
/** Any signed-in user with a valid JWT. */
export const Authenticated = () => SetMetadata(AUTHENTICATED_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
