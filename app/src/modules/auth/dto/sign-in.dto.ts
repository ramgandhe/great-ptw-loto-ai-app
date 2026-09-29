import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

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
  newPassword!: string;
}
