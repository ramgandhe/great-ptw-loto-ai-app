import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// NFR-SEC-003: AES-256-GCM with "<record id>:<field>" as associated data, so a value cannot be moved to
// another record or field. Layout: key version (4 bytes) | IV (12) | tag (16) | ciphertext.

export function encryptField(key: Buffer, keyVersion: number, plaintext: string, aad: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const version = Buffer.alloc(4);
  version.writeUInt32BE(keyVersion);
  return Buffer.concat([version, iv, cipher.getAuthTag(), body]);
}

export function keyVersionOf(blob: Buffer): number {
  return blob.readUInt32BE(0);
}

export function decryptField(key: Buffer, blob: Buffer, aad: string): string {
  if (blob.length < 32) throw new Error('Encrypted field is malformed');
  const decipher = createDecipheriv('aes-256-gcm', key, blob.subarray(4, 16), { authTagLength: 16 });
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(blob.subarray(16, 32));
  return Buffer.concat([decipher.update(blob.subarray(32)), decipher.final()]).toString('utf8');
}
