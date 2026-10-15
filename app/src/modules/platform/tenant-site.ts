/** Default site created with a tenant. Name keeps spaces; code is that name with spaces removed. */
export function defaultSiteLabel(organisationName: string, addressLine1: string): { name: string; code: string } {
  const street = addressLine1.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const name = `${organisationName.trim()} ${street}`.replace(/\s+/g, ' ').trim().slice(0, 255);
  const code = name.replace(/\s+/g, '').replace(/[^\p{L}\p{N}._\-/]/gu, '').slice(0, 64) || 'SITE';
  return { name, code };
}

export function formatOrganisationAddress(parts: {
  addressLine1: string;
  addressLine2?: string | null;
  state: string;
  country: string;
  pin: string;
}): string {
  return [parts.addressLine1, parts.addressLine2, parts.state, parts.country, parts.pin]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ');
}
