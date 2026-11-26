import type {
  LototoPdfExtractedImage,
  LototoPdfLlmDraft,
  LototoPdfPage,
  LototoPdfTenantHints,
} from './lototo-pdf-extraction.types';

export const PROCEDURE_LLM_PROVIDER = Symbol('PROCEDURE_LLM_PROVIDER');

export interface ProcedureLlmProvider {
  interpret(input: {
    pages: LototoPdfPage[];
    imageCount: number;
    figures?: LototoPdfExtractedImage[];
    hints: LototoPdfTenantHints;
    missingPhase?: 'apply' | 'remove';
  }): Promise<LototoPdfLlmDraft>;
}
