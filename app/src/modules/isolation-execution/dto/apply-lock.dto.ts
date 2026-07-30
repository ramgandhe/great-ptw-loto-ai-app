import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ApplyLockDto {
  @IsUUID()
  isolationPointId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lockTag!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lockMethod!: string;
}
