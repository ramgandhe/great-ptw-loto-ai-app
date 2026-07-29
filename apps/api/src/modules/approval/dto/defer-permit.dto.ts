import { IsNotEmpty, IsString } from 'class-validator';

export class DeferPermitDto {
  @IsString()
  @IsNotEmpty()
  comment!: string;
}
