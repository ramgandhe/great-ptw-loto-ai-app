import { Injectable } from '@nestjs/common';

/** Decomposes complex questions into sub-queries for multi-hop retrieval. */
@Injectable()
export class QueryDecomposer {
  decompose(query: string): string[] {
    const parts = query
      .split(/\band\b|\bthen\b|;/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return parts.length > 0 ? parts : [query.trim()];
  }
}
