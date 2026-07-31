import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RemoveTagDto {
  @IsUUID()
  appliedTagId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
