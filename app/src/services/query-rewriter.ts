import { Injectable } from '@nestjs/common';

/** Rewrites user queries for retrieval (clarify PTW domain terms). */
@Injectable()
export class QueryRewriter {
  rewrite(query: string): string {
    return query
      .trim()
      .replace(/\bptw\b/gi, 'permit to work')
      .replace(/\bloto\b/gi, 'lock out tag out');
  }
}
