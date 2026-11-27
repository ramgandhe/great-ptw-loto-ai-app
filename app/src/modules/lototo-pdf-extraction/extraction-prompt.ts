import { LOTOTO_ENERGY_TYPES } from '../lototo/lototo.constants';
import { LOTOTO_ISOLATION_METHODS, LOTOTO_PROOFS } from '../lototo/lototo-point';
import type { LototoPdfTenantHints } from './lototo-pdf-extraction.types';

export function buildLototoPdfPrompt(
  hints: LototoPdfTenantHints,
  imageCount: number,
  pageText: string,
  missingPhase?: 'apply' | 'remove',
): string {
  const assets = hints.assets
    .slice(0, 200)
    .map((row) => `${row.code} — ${row.name}`)
    .join('\n');
  const locations = hints.workLocations
    .slice(0, 200)
    .map((row) => `${row.code} — ${row.name}`)
    .join('\n');
  return [
    missingPhase
      ? `The procedure is incomplete. Return sequenceSteps that use phase "${missingPhase}" only, one object per numbered ${missingPhase === 'remove' ? 'removal or restoration' : 'application or shutdown'} step in the text.`
      : 'Extract one LOTOTO procedure from the document pages and text.',
    'Return JSON only, no markdown.',
    'Do not invent text you cannot read. Leave unknown optional fields empty.',
    'Map assetCode and workLocationCode only from the tenant lists when the document clearly matches one.',
    `Energy types: ${LOTOTO_ENERGY_TYPES.join(', ')}.`,
    `Methods: ${LOTOTO_ISOLATION_METHODS.join(', ')}.`,
    `Proofs: ${LOTOTO_PROOFS.join(', ')}.`,
    'Phases must be exactly apply or remove.',
    'Put every numbered step from a lockout application, shutdown, or tryout sequence in sequenceSteps with phase apply.',
    'Put every numbered step from a lockout removal or restoration sequence in sequenceSteps with phase remove.',
    'Lockout points are the isolation devices (codes such as E-1), not those numbered process steps.',
    `This document has ${imageCount} cropped photos. Return images as an empty array. Photos are placed from the page layout.`,
    'JSON shape: {"code","title","assetCode","workLocationCode","facility","locationText","purpose","scope","authorization","enforcement","description","note","reviewDueOn","lockoutPoints":[{"sortOrder","pointCode","energyType","energyOtherText","magnitude","locationText","method","normalPosition","isolatedPosition","action","restoreAction","device","proof","drawingReference","removeOrder","verificationMethod"}],"sequenceSteps":[{"phase","sequenceOrder","title","action","infoText","verification","note","description"}],"images":[]}',
    'Tenant assets:',
    assets || '(none)',
    'Tenant work locations:',
    locations || '(none)',
    'Extracted page text:',
    pageText.slice(0, 60000),
  ].join('\n');
}
