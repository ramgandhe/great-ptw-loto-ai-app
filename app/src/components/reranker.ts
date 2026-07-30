import { Injectable } from '@nestjs/common';
import { RetrievedChunk } from './hybrid-retriever';

/** Reranks retrieved chunks by simple lexical overlap with the query. */
@Injectable()
export class Reranker {
  rerank(query: string, chunks: RetrievedChunk[]): RetrievedChunk[] {
    const tokens = new Set(query.toLowerCase().split(/\s+/).filter(Boolean));
    return [...chunks]
      .map((chunk) => {
        const haystack = `${chunk.title} ${chunk.content}`.toLowerCase();
        let overlap = 0;
        for (const token of tokens) {
          if (haystack.includes(token)) {
            overlap += 1;
          }
        }
        return {
          ...chunk,
          score: chunk.score * (1 + overlap * 0.1),
        };
      })
      .sort((a, b) => b.score - a.score);
  }
}
