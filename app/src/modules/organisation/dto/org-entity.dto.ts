import { IsIn, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { NAME_MESSAGE, NAME_REGEX, TEXT_MESSAGE, TEXT_REGEX } from '../../../common/validation';
import { APPROVAL_APPROVER_ROLES } from '../../approval/default-workflow';

export class CreateOrgEntityDto {
  @IsString()
  @MinLength(1)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
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
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
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
