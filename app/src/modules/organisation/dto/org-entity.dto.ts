import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { APPROVAL_APPROVER_ROLES } from '../../approval/default-workflow';

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
  @IsIn([...APPROVAL_APPROVER_ROLES])
  approverRole?: string;

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
  @IsIn([...APPROVAL_APPROVER_ROLES])
  approverRole?: string;

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
