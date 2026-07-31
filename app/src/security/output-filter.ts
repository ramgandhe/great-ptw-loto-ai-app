import { Injectable } from '@nestjs/common';

/** Output filter: keep assistant responses within safe presentation bounds. */
@Injectable()
export class OutputFilter {
  filter(answer: string): string {
    return [...answer].filter((char) => char.charCodeAt(0) !== 0).join('').trim();
  }
}
