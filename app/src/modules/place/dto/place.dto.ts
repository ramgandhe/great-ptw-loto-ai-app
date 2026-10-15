import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NAME_MESSAGE, NAME_REGEX, TEXT_MESSAGE, TEXT_REGEX } from '../../../common/validation';

/** Codes and tags may start with a digit, unlike display names. */
const CODE_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} ._\-/]*$/u;
const CODE_MESSAGE = 'use letters or digits, and only letters, digits, spaces and . _ - /';

export class CreateSiteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: CODE_MESSAGE })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('address') })
  address?: string;
}

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: CODE_MESSAGE })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('address') })
  address?: string;
}

export class AddSiteMemberDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string;
}

export class CreateNamedTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateNamedTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}

export class CreateWorkLocationDto {
  @IsUUID()
  siteId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: CODE_MESSAGE })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsOptional()
  @IsUUID()
  locationTypeId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('address') })
  address?: string;
}

export class UpdateWorkLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: CODE_MESSAGE })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name?: string;

  @IsOptional()
  @IsUUID()
  locationTypeId?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('address') })
  address?: string;
}

export class PutApproversDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  userIds!: string[];
}

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: CODE_MESSAGE })
  tag!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: CODE_MESSAGE })
  assetNumber?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsUUID()
  workLocationId!: string;

  @IsOptional()
  @IsUUID()
  assetTypeId?: string;

  @IsOptional()
  @IsUUID()
  parentAssetId?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: CODE_MESSAGE })
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(CODE_REGEX, { message: CODE_MESSAGE })
  assetNumber?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name?: string;

  @IsOptional()
  @IsUUID()
  workLocationId?: string;

  @IsOptional()
  @IsUUID()
  assetTypeId?: string | null;

  @IsOptional()
  @IsUUID()
  parentAssetId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;
}
