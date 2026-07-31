import { IsString, MinLength } from 'class-validator';

export class SuspendPermitDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
