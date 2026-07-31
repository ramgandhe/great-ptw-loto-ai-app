import { Injectable } from '@nestjs/common';
import { QueryRoute } from '../services/query-router';

/** LLM-driven source selection stub — adjusts route from query signals. */
@Injectable()
export class AdaptiveRouter {
  select(query: string, fallback: QueryRoute): QueryRoute {
    const q = query.toLowerCase();
    if (q.includes('simops') || q.includes('simultaneous')) {
      return 'policy';
    }
    return fallback;
  }
}
