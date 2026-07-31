import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateLototoPlanDto {
  @IsUUID()
  permitId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @IsOptional()
  @IsUUID()
  machineryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  reference?: string;
}
