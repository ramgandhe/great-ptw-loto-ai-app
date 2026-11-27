import { BadRequestException } from '@nestjs/common';
import {
  assertOrganisationLogo,
  organisationAddress,
  organisationLogoKey,
  presentOrganisation,
} from '../app/src/modules/organisation/organisation-logo';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('organisation logo', () => {
  it('accepts a small PNG, JPEG and WebP images', () => {
    expect(() => assertOrganisationLogo({ mimetype: 'image/png', size: PNG.length, buffer: PNG })).not.toThrow();
    expect(() => assertOrganisationLogo({ mimetype: 'image/jpeg', size: 100, buffer: Buffer.from('jpeg-bytes') })).not.toThrow();
    expect(() => assertOrganisationLogo({ mimetype: 'image/webp; charset=binary', size: 100, buffer: Buffer.from('webp-bytes') })).not.toThrow();
  });

  it('validates edge cases: missing files, empty buffers, invalid types and size limits', () => {
    expect(() => assertOrganisationLogo(undefined)).toThrow(
      new BadRequestException('Choose a logo image.'),
    );
    expect(() => assertOrganisationLogo({ mimetype: 'image/png', size: 0, buffer: Buffer.alloc(0) })).toThrow(
      new BadRequestException('Choose a logo image.'),
    );
    expect(() => assertOrganisationLogo({ mimetype: 'application/pdf', size: 10, buffer: Buffer.from('x') })).toThrow(
      new BadRequestException('Logo must be a PNG, JPEG or WebP image.'),
    );
    expect(() => assertOrganisationLogo({ mimetype: 'image/svg+xml', size: 50, buffer: Buffer.from('<svg></svg>') })).toThrow(
      new BadRequestException('Logo must be a PNG, JPEG or WebP image.'),
    );
    // Boundary check: exactly 2 MB passes
    expect(() => assertOrganisationLogo({ mimetype: 'image/png', size: 2 * 1024 * 1024, buffer: PNG })).not.toThrow();
    // Exceeding 2 MB fails
    expect(() => assertOrganisationLogo({ mimetype: 'image/png', size: 2 * 1024 * 1024 + 1, buffer: PNG })).toThrow(
      new BadRequestException('Logo must be 2 MB or smaller.'),
    );
  });

  it('keeps the storage key off the API record', () => {
    const shown = presentOrganisation({
      id: 'org',
      name: 'ViXR',
      logoStorageKey: 'organisations/tenant/logo',
      logoFileName: 'mark.png',
    });
    expect(shown).toEqual({ id: 'org', name: 'ViXR', logoFileName: 'mark.png', hasLogo: true });
    expect(shown).not.toHaveProperty('logoStorageKey');
  });

  it('builds one stable object key and a printable address', () => {
    expect(organisationLogoKey('tenant-1')).toBe('organisations/tenant-1/logo');
    expect(
      organisationAddress({
        addressLine1: '12 Harbour Road',
        addressState: 'Kerala',
        addressPin: '682001',
      }),
    ).toBe('12 Harbour Road, Kerala, 682001');
    expect(organisationAddress({})).toBeNull();
  });
});
