import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { Authenticated } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @Post('logout')
  logout() {
    return this.authService.logout();
  }
}
