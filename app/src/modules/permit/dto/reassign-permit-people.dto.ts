import { ArrayMinSize, IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PermitExecutorDto, PermitLototoPersonDto } from './permit-relations.dto';

export class PermitLototoPeopleDto {
  @IsUUID()
  procedureId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermitLototoPersonDto)
  crew!: PermitLototoPersonDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermitLototoPersonDto)
  verifiers!: PermitLototoPersonDto[];
}

export class ReassignPermitPeopleDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermitExecutorDto)
  executors?: PermitExecutorDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitLototoPeopleDto)
  lototo?: PermitLototoPeopleDto[];
}
