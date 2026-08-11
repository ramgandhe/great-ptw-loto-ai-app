import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateWorkflowTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  permitTypeId?: string;

  @IsOptional()
  @IsIn(['restart_from_stage_1', 'resume_from_rejecting_stage'])
  resubmitMode?: 'restart_from_stage_1' | 'resume_from_rejecting_stage';
}
