import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Data keys through the managed key service (OpenBao/Vault Transit). The master key never leaves it.
 * The API can get a new wrapped data key and unwrap one, and nothing else (NFR-SEC-003).
 */
@Injectable()
export class KeyService {
  // ponytail: in-process cache, one entry per tenant key version, 5-minute life. Never Redis.
  private readonly unwrapped = new Map<string, { key: Buffer; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  async createDataKey(): Promise<string> {
    const data = await this.call(`datakey/wrapped/${this.keyName()}`, { bits: 256 });
    return data.ciphertext as string;
  }

  async unwrap(wrapped: string): Promise<Buffer> {
    const hit = this.unwrapped.get(wrapped);
    if (hit && hit.expiresAt > Date.now()) return hit.key;
    const data = await this.call(`decrypt/${this.keyName()}`, { ciphertext: wrapped });
    const key = Buffer.from(data.plaintext as string, 'base64');
    if (key.length !== 32) throw new Error('Key service returned a data key of the wrong length');
    this.unwrapped.set(wrapped, { key, expiresAt: Date.now() + 5 * 60_000 });
    return key;
  }

  private keyName(): string {
    return this.config.get<string>('keyService.keyName') ?? 'ptw-master';
  }

  private async call(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.config.get<string>('keyService.url')}/v1/transit/${path}`, {
      method: 'POST',
      headers: { 'X-Vault-Token': this.config.get<string>('keyService.token') ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Key service refused ${path.split('/')[0]} (${response.status})`);
    return ((await response.json()) as { data: Record<string, unknown> }).data;
  }
}
