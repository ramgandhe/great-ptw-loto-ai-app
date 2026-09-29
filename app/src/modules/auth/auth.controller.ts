import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';
import { Authenticated, Public } from '../../common/decorators/auth.decorators';
import { FirstPasswordDto, RefreshSessionDto, SignInDto } from './dto/sign-in.dto';
import { SignInService } from './sign-in.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly signInService: SignInService,
  ) {}

  // Sign-in happens on the app's own page; these relay to Keycloak server side.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sign-in')
  signIn(@Body() dto: SignInDto) {
    return this.signInService.signIn(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sign-in/new-password')
  setFirstPassword(@Body() dto: FirstPasswordDto) {
    return this.signInService.setFirstPassword(dto.email, dto.password, dto.newPassword);
  }

  @Public()
  @Post('session/refresh')
  refresh(@Body() dto: RefreshSessionDto) {
    return this.signInService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('sign-out')
  async signOut(@Body() dto: RefreshSessionDto) {
    await this.signInService.signOut(dto.refreshToken);
    return { signedOut: true };
  }

  @Authenticated()
  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user);
  }

  @Authenticated()
  @Patch('profile')
  updateProfile(@Body() dto: UpdateUserProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.updateProfile(dto, user);
  }

  @Authenticated()
  @Post('profile/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @UploadedFile() file: UploadedFilePayload,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.uploadAvatar(file, user);
  }

  @Authenticated()
  @Delete('profile/avatar')
  removeAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.removeAvatar(user);
  }

  @Authenticated()
  @Post('logout')
  logout() {
    return this.authService.logout();
  }
}
