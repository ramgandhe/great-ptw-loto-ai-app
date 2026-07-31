import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class VerifyIncidentDto {
  @IsBoolean()
  correctiveActionsConfirmed!: boolean;

  @IsBoolean()
  preventiveActionsReviewed!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;
}

export class CloseIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;
}

export class IncidentArchiveSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  incidentType?: string;
}
