import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PPE_CATEGORIES } from '../master-data.constants';

export class CreatePpeDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsIn([...PPE_CATEGORIES])
  category!: (typeof PPE_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
