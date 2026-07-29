import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOrganisationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;
}

export class UpdateOrganisationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;
}
