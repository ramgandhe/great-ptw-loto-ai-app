import { BadRequestException, Injectable } from '@nestjs/common';

/** Input guard: reject empty / oversized prompts. */
@Injectable()
export class InputGuard {
  private readonly maxLength = 4000;

  validate(query: string): void {
    const trimmed = query?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException('Query must not be empty');
    }
    if (trimmed.length > this.maxLength) {
      throw new BadRequestException(`Query exceeds ${this.maxLength} characters`);
    }
  }

  healthy(): boolean {
    return true;
  }
}
