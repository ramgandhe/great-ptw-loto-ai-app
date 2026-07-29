import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class ProgressUpdateDto {
  @IsString()
  @MinLength(1)
  summary!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
