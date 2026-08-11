import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { COSIGN_SOURCE_ENTITY_TYPES } from '../../database/schema';

export class CreateCosignatureDto {
  @IsIn([...COSIGN_SOURCE_ENTITY_TYPES])
  sourceEntityType!: (typeof COSIGN_SOURCE_ENTITY_TYPES)[number];

  @IsUUID()
  sourceEntityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
