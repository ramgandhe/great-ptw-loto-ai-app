import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../../common/validation';

export class SignInDto {
  @IsEmail({}, { message: 'Enter the email you sign in with' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password' })
  @MaxLength(256)
  password!: string;
}

export class FirstPasswordDto extends SignInDto {
  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters for the new password' })
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

export class RefreshSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  refreshToken!: string;
}

export class PasswordResetRequestDto {
  @IsEmail({}, { message: 'Enter the email you sign in with' })
  @MaxLength(255)
  email!: string;
}

export class PasswordResetCompleteDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters for the new password' })
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
