import { Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Authenticated } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Authenticated()
  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user);
  }

  @Authenticated()
  @Post('logout')
  logout() {
    return this.authService.logout();
  }
}
