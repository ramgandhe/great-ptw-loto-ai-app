import { IsNotEmpty, IsString } from 'class-validator';

export class SafetyOfficerVetoDto {
  @IsString()
  @IsNotEmpty()
  comment!: string;
}
