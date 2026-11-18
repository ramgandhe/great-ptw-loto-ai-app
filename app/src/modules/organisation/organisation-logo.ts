import { BadRequestException } from '@nestjs/common';

export const ORGANISATION_LOGO_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const ORGANISATION_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export function organisationLogoKey(tenantId: string): string {
  return `organisations/${tenantId}/logo`;
}

export function assertOrganisationLogo(file: { mimetype?: string; size?: number; buffer?: Buffer } | undefined): asserts file is {
  mimetype: string;
  size: number;
  buffer: Buffer;
} {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Choose a logo image.');
  }
  const type = (file.mimetype ?? '').split(';')[0].trim().toLowerCase();
  if (!(ORGANISATION_LOGO_CONTENT_TYPES as readonly string[]).includes(type)) {
    throw new BadRequestException('Logo must be a PNG, JPEG or WebP image.');
  }
  if ((file.size ?? file.buffer.length) > ORGANISATION_LOGO_MAX_BYTES) {
    throw new BadRequestException('Logo must be 2 MB or smaller.');
  }
}

export function presentOrganisation<T extends { logoStorageKey: string | null }>(row: T) {
  const { logoStorageKey, ...rest } = row;
  return { ...rest, hasLogo: Boolean(logoStorageKey) };
}

export function organisationAddress(row: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  addressPin?: string | null;
}): string | null {
  const line = [row.addressLine1, row.addressLine2, row.addressState, row.addressCountry, row.addressPin]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  return line || null;
}
