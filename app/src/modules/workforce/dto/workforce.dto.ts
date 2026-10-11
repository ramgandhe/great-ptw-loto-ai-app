import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { NAME_MESSAGE, NAME_REGEX, PHONE_MESSAGE, PHONE_REGEX, TEXT_MESSAGE, TEXT_REGEX } from '../../../common/validation';
import { TENANT_ASSIGNABLE_ROLES } from '../workforce.constants';

export class CreateWorkforceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  agencyId?: string;
}

export class UpdateWorkforceDto extends CreateWorkforceDto {}

export class CreateCompetencyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsOptional()
  @IsString()
  workforceUserId?: string;

  @IsOptional()
  @IsString()
  certificationName?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a date (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'expiryDate must be a date (YYYY-MM-DD)' })
  expiryDate?: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('description') })
  description?: string;
}

export class UpdateCompetencyDto extends CreateCompetencyDto {}

export class AssignRoleDto {
  @IsOptional()
  @IsString()
  @IsIn([...TENANT_ASSIGNABLE_ROLES])
  role?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...TENANT_ASSIGNABLE_ROLES], { each: true })
  roles?: string[];
}

export class CreateTenantUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('name') })
  name!: string;

  @IsEmail()
  email!: string;

  @ValidateIf((dto: CreateTenantUserDto) => !dto.roles?.length)
  @IsString()
  @IsIn([...TENANT_ASSIGNABLE_ROLES])
  role?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn([...TENANT_ASSIGNABLE_ROLES], { each: true })
  roles?: string[];

  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  departmentId?: string;
}
