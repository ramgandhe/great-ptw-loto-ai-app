import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { TENANT_ASSIGNABLE_ROLES } from '../workforce.constants';

export class CreateWorkforceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
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
  name!: string;

  @IsOptional()
  @IsString()
  workforceUserId?: string;

  @IsOptional()
  @IsString()
  certificationName?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCompetencyDto extends CreateCompetencyDto {}

export class AssignRoleDto {
  @IsString()
  @IsIn([...TENANT_ASSIGNABLE_ROLES])
  role!: string;
}

export class CreateTenantUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsIn([...TENANT_ASSIGNABLE_ROLES])
  role!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  departmentId?: string;
}
