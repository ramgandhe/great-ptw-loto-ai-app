import { Injectable } from '@nestjs/common';

export interface RetrievedChunk {
  id: string;
  title: string;
  content: string;
  score: number;
}

/**
 * Custom hybrid retrieval: keyword + semantic stubs for PTW knowledge.
 * Replace internals with vector/DB search when index is ready.
 */
@Injectable()
export class HybridRetriever {
  async retrieve(query: string, limit = 5): Promise<RetrievedChunk[]> {
    const normalised = query.trim().toLowerCase();
    if (!normalised) {
      return [];
    }

    const corpus: RetrievedChunk[] = [
      {
        id: 'ptw-lifecycle',
        title: 'Permit lifecycle',
        content:
          'Permits move through draft, submitted, approved, active, suspended, and closed states with role-gated transitions.',
        score: 0.9,
      },
      {
        id: 'loto-isolation',
        title: 'LOTO isolation',
        content:
          'Lock Out Tag Out requires verified isolation points, personal locks, and documented restoration before closure.',
        score: 0.85,
      },
      {
        id: 'simops',
        title: 'Simultaneous operations',
        content:
          'SIMOPS checks flag overlapping work in the same plant area before approval can proceed.',
        score: 0.8,
      },
    ];

    return corpus
      .map((chunk) => ({
        ...chunk,
        score:
          chunk.score *
          (normalised.split(/\s+/).some((token) => chunk.content.toLowerCase().includes(token) || chunk.title.toLowerCase().includes(token))
            ? 1
            : 0.4),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
