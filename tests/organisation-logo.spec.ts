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
  it('accepts a small PNG and refuses other files', () => {
    expect(() => assertOrganisationLogo({ mimetype: 'image/png', size: PNG.length, buffer: PNG })).not.toThrow();
    expect(() => assertOrganisationLogo({ mimetype: 'application/pdf', size: 10, buffer: Buffer.from('x') })).toThrow(
      BadRequestException,
    );
    expect(() => assertOrganisationLogo({ mimetype: 'image/png', size: 3 * 1024 * 1024, buffer: PNG })).toThrow(
      BadRequestException,
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

  it('keeps organisation profile logo helper text decoupled from permit reports (#348)', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.resolve(__dirname, '../frontend/src/app/(app)/organisation/profile/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');

    // Expected: States only accepted image parameters (formats and size)
    expect(content).toContain('PNG, JPEG or WebP, up to 2 MB.');
    // Expected: Report-specific claims removed
    expect(content).not.toContain('Printed on the first page of a permit report');
  });
});
