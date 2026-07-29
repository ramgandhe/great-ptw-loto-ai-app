import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOrgEntityDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  plantId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateOrgEntityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  plantId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class CreateNotificationPreferenceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  enabled?: boolean;
}

export class UpdateNotificationPreferenceDto extends CreateNotificationPreferenceDto {}
