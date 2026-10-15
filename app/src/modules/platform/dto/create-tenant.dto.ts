import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { NAME_MESSAGE, NAME_REGEX, TEXT_MESSAGE, TEXT_REGEX } from '../../../common/validation';

const PIN_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} \-]{0,31}$/u;

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('organisationName') })
  organisationName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsOptional()
  @IsString()
  ownerFirstName?: string;

  @IsOptional()
  @IsString()
  ownerLastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('about') })
  about?: string;

  @IsUUID()
  industryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('addressLine1') })
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('addressLine2') })
  addressLine2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('state') })
  state!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('country') })
  country!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(PIN_REGEX, { message: 'pin must be letters or digits' })
  pin!: string;
}

export class UpdateTenantDto {
  @IsString()
  @MinLength(1)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('organisationName') })
  organisationName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('about') })
  about?: string | null;

  @IsUUID()
  industryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('addressLine1') })
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('addressLine2') })
  addressLine2?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('state') })
  state!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('country') })
  country!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(PIN_REGEX, { message: 'pin must be letters or digits' })
  pin!: string;
}

export class IndustryNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;
}
