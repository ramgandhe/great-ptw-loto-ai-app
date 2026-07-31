import { Injectable } from '@nestjs/common';

/** Pluggable code/docs search tool (stub). */
@Injectable()
export class CodeSearchTool {
  async search(query: string): Promise<Array<{ path: string; snippet: string }>> {
    void query;
    return [];
  }
}
