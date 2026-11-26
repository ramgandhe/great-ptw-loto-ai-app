import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assignPhotosByPosition, missingSequencePhase, normalizeLototoPdfDraft } from './extraction-normalizer';
import { readLototoPdf } from './pdf-document-reader';
import { PROCEDURE_LLM_PROVIDER, ProcedureLlmProvider } from './procedure-llm.provider';
import type {
  LototoPdfExtractedImage,
  LototoPdfExtractionResult,
  LototoPdfTenantHints,
} from './lototo-pdf-extraction.types';

export type LototoPdfExtractionBundle = {
  result: LototoPdfExtractionResult;
  images: LototoPdfExtractedImage[];
};

@Injectable()
export class LototoPdfExtractionService {
  constructor(@Inject(PROCEDURE_LLM_PROVIDER) private readonly llm: ProcedureLlmProvider) {}

  async extract(
    pdf: Buffer,
    hints: LototoPdfTenantHints,
    onStage?: (stage: 'extracting' | 'interpreting') => Promise<void> | void,
  ): Promise<LototoPdfExtractionBundle> {
    await onStage?.('extracting');
    const document = await readLototoPdf(pdf);
    if (document.pages.length === 0) {
      throw new BadRequestException('PDF has no pages');
    }
    await onStage?.('interpreting');
    let draft = await this.llm.interpret({
      pages: document.pages,
      imageCount: document.images.length,
      hints,
    });
    let normalized = normalizeLototoPdfDraft(draft);
    const missing = missingSequencePhase(draft);
    if (missing) {
      const extra = await this.llm.interpret({
        pages: document.pages,
        imageCount: document.images.length,
        hints,
        missingPhase: missing,
      });
      draft = {
        ...draft,
        sequenceSteps: [...(draft.sequenceSteps ?? []), ...(extra.sequenceSteps ?? [])],
      };
      normalized = normalizeLototoPdfDraft(draft);
    }
    if (!normalized.result) {
      throw new BadRequestException(normalized.fatal ?? 'PDF could not be turned into a procedure draft');
    }
    if (!normalized.result.dto.code?.trim()) {
      normalized.result.dto.code = `PDF-${randomUUID().slice(0, 8).toUpperCase()}`;
    }
    normalized.result.procedureCode = normalized.result.dto.code;
    if (!normalized.result.dto.title?.trim()) {
      normalized.result.dto.title = 'Untitled procedure';
    }
    const placed = assignPhotosByPosition(
      document.images,
      document.lines,
      (normalized.result.dto.lockoutPoints ?? []).map((point) => point.pointCode),
    );
    normalized.result.images = placed.refs;
    normalized.result.warnings.push(...placed.warnings);
    return { result: normalized.result, images: document.images };
  }
}
