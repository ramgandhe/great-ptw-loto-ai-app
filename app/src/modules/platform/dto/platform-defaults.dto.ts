import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { NAME_MESSAGE, NAME_REGEX, TEXT_MESSAGE, TEXT_REGEX } from '../../../common/validation';

const CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,63}$/;

export class DefaultLocationTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;
}

export class DefaultEnergySourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;
}

export class DefaultPpeCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;
}

export class DefaultPpeItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: 'code must start with a letter or digit' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;
}

export class DefaultPermitTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: 'code must start with a letter or digit' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex value such as #2563EB' })
  color!: string;
}
