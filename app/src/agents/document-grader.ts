import { Injectable } from '@nestjs/common';
import { RetrievedChunk } from '../components/hybrid-retriever';

/** Grades retrieved documents for relevance before answer generation. */
@Injectable()
export class DocumentGrader {
  grade(query: string, chunks: RetrievedChunk[], minScore = 0.5): RetrievedChunk[] {
    void query;
    return chunks.filter((chunk) => chunk.score >= minScore);
  }
}
