import { Injectable } from '@nestjs/common';

interface CacheEntry {
  answer: string;
  sources: Array<{ id: string; title: string; score: number }>;
  route: string;
  expiresAt: number;
}

/** In-memory semantic cache stub (authoritative data remains in PostgreSQL). */
@Injectable()
export class SemanticCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly ttlMs = 5 * 60 * 1000;

  get(query: string): CacheEntry | null {
    const key = this.normalise(query);
    const hit = this.store.get(key);
    if (!hit) {
      return null;
    }
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return hit;
  }

  set(
    query: string,
    value: Omit<CacheEntry, 'expiresAt'>,
  ): void {
    this.store.set(this.normalise(query), {
      ...value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  healthy(): boolean {
    return true;
  }

  private normalise(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
