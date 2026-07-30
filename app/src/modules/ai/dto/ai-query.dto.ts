import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AiQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  query!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  permitId?: string;
}
