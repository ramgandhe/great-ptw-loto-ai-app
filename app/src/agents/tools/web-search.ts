import { Injectable } from '@nestjs/common';

/** Pluggable web search tool (stub — disabled in production by default). */
@Injectable()
export class WebSearchTool {
  async search(query: string): Promise<Array<{ title: string; url: string }>> {
    void query;
    return [];
  }
}
