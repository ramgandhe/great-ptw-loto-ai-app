import { Injectable } from '@nestjs/common';

/** Content filter: strip control characters and obvious injection markers. */
@Injectable()
export class ContentFilter {
  filter(query: string): string {
    return query
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/```system/gi, '')
      .trim();
  }
}
