import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ApplyTagDto {
  @IsUUID()
  isolationPointId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tagNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tagType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
