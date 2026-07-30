import { Injectable } from '@nestjs/common';

function stripDisallowedControlChars(input: string): string {
  return [...input]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join('');
}

/** Content filter: strip control characters and obvious injection markers. */
@Injectable()
export class ContentFilter {
  filter(query: string): string {
    return stripDisallowedControlChars(query).replace(/```system/gi, '').trim();
  }
}
