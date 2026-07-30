import { Injectable } from '@nestjs/common';

/** Pluggable vector search tool (stub). */
@Injectable()
export class VectorSearchTool {
  async search(query: string, limit = 5): Promise<Array<{ id: string; text: string }>> {
    void query;
    void limit;
    return [];
  }
}
