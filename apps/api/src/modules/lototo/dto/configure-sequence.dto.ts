import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class SequenceStepDto {
  @IsUUID()
  isolationPointId!: string;

  @IsInt()
  @Min(1)
  sequenceOrder!: number;

  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean;
}

export class ConfigureSequenceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SequenceStepDto)
  steps!: SequenceStepDto[];
}
