import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateLototoPlanDto {
  @IsUUID()
  machineryId!: string;

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
  @IsString()
  @MaxLength(32)
  reference?: string;
}
