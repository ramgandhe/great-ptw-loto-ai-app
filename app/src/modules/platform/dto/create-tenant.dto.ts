import { IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { NAME_MESSAGE, NAME_REGEX } from '../../../common/validation';

export class CreateTenantDto {
  @IsString()
  @MinLength(1)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('organisationName') })
  organisationName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsOptional()
  @IsString()
  ownerFirstName?: string;

  @IsOptional()
  @IsString()
  ownerLastName?: string;
}
