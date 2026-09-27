import { Equals, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const SITE_COUNT_OPTIONS = ['1', '2-5', '6-20', '20+'] as const;

export class CreateAccessRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @IsEmail()
  @MaxLength(255)
  workEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  jobTitle?: string;

  @IsOptional()
  @IsIn(SITE_COUNT_OPTIONS)
  siteCount?: (typeof SITE_COUNT_OPTIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  /** Explicit consent to processing under the privacy notice (DPDP Act 2023, s.6). */
  @Equals(true)
  consent!: boolean;
}
