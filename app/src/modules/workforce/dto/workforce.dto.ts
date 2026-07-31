import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWorkforceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

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
  @MinLength(1)
  role!: string;
}
