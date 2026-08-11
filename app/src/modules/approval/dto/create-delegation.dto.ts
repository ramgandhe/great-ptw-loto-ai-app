import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDelegationDto {
  @IsUUID()
  delegateId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  coversRole!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
