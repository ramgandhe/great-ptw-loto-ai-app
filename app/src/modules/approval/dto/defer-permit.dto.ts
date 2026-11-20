import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { TEXT_MESSAGE, TEXT_REGEX } from '../../../common/validation';

export class DeferPermitDto {
  @IsString()
  @IsNotEmpty()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('comment') })
  comment!: string;
}
