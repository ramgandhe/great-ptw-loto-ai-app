import { Module } from '@nestjs/common';
import { LototoPdfExtractionService } from './lototo-pdf-extraction.service';
import { NvidiaNimVlmProvider } from './nvidia-nim-vlm.provider';
import { PROCEDURE_LLM_PROVIDER } from './procedure-llm.provider';

@Module({
  providers: [
    LototoPdfExtractionService,
    NvidiaNimVlmProvider,
    { provide: PROCEDURE_LLM_PROVIDER, useExisting: NvidiaNimVlmProvider },
  ],
  exports: [LototoPdfExtractionService],
})
export class LototoPdfExtractionModule {}
