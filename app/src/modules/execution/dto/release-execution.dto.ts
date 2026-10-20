import { IsBoolean } from 'class-validator';

export class ReleaseExecutionDto {
  @IsBoolean()
  siteReady!: boolean;

  @IsBoolean()
  detailsCorrect!: boolean;
}
