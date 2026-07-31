import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RemoveLockDto {
  @IsUUID()
  appliedLockId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
