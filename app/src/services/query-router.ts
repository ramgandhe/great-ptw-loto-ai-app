import { Injectable } from '@nestjs/common';

export type QueryRoute = 'permit' | 'loto' | 'general' | 'policy';

/** Routes queries to domain-specific retrieval paths. */
@Injectable()
export class QueryRouter {
  route(query: string): QueryRoute {
    const q = query.toLowerCase();
    if (/\bloto\b|lock\s*out|isolation/.test(q)) {
      return 'loto';
    }
    if (/\bpermit\b|approval|closure|execution/.test(q)) {
      return 'permit';
    }
    if (/\bpolicy\b|procedure|sop|standard/.test(q)) {
      return 'policy';
    }
    return 'general';
  }
}
