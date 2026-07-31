import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UserProfile } from '@ptw/shared';

@Injectable()
export class AuthService {
  getProfile(user: AuthenticatedUser): UserProfile {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      tenantId: user.tenantId,
    };
  }

  logout(): { message: string } {
    return { message: 'Logout acknowledged. Invalidate tokens on the client.' };
  }
}
