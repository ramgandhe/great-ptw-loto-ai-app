import { defaultSiteLabel, formatOrganisationAddress } from '../app/src/modules/platform/tenant-site';

describe('default site from the organisation', () => {
  it('joins the organisation name and address line 1 without commas', () => {
    expect(defaultSiteLabel('Acme Chemicals', 'Plot 12, MIDC')).toEqual({
      name: 'Acme Chemicals Plot 12 MIDC',
      code: 'AcmeChemicalsPlot12MIDC',
    });
  });

  it('writes the site address as the full address', () => {
    expect(
      formatOrganisationAddress({
        addressLine1: 'Plot 12, MIDC',
        addressLine2: 'Near Gate 2',
        state: 'Maharashtra',
        country: 'India',
        pin: '400001',
      }),
    ).toBe('Plot 12, MIDC, Near Gate 2, Maharashtra, India, 400001');
  });

  it('omits a blank address line 2', () => {
    expect(
      formatOrganisationAddress({
        addressLine1: 'Plot 12, MIDC',
        state: 'Maharashtra',
        country: 'India',
        pin: '400001',
      }),
    ).toBe('Plot 12, MIDC, Maharashtra, India, 400001');
  });
});
