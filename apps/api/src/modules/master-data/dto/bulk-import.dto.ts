import { IsBoolean, IsOptional } from 'class-validator';

export class BulkImportDto {
  @IsOptional()
  @IsBoolean()
  partialImport?: boolean;
}
