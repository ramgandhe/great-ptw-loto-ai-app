import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPermitDto {
  @IsString()
  @IsNotEmpty()
  comment!: string;
}
