import { Injectable } from '@nestjs/common';
import { PROMPT_TEMPLATES, PromptKey } from './templates';

/** Versioned, type-specific, hot-swappable prompt registry. */
@Injectable()
export class PromptRegistry {
  private readonly overrides = new Map<PromptKey, string>();

  get(key: PromptKey): string {
    return this.overrides.get(key) ?? PROMPT_TEMPLATES[key];
  }

  set(key: PromptKey, value: string): void {
    this.overrides.set(key, value);
  }

  reset(key?: PromptKey): void {
    if (key) {
      this.overrides.delete(key);
      return;
    }
    this.overrides.clear();
  }
}
