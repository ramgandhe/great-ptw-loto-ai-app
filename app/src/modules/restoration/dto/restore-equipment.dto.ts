import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RestoreEquipmentDto {
  @IsUUID()
  isolationPointId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
