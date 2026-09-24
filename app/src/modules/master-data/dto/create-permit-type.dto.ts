import { IsBoolean, IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreatePermitTypeDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex value such as #2563EB' })
  color?: string;

  @IsOptional()
  @IsObject()
  defaultAttributes?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
