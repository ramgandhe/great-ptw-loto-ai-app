export const LOTOTO_ISOLATION_METHODS = [
  'lock_closed',
  'lock_open',
  'remove',
  'block',
  'disconnect',
  'vent',
  'drain',
  'blind',
  'tag_only',
] as const;
export type LototoIsolationMethod = (typeof LOTOTO_ISOLATION_METHODS)[number];

export const LOTOTO_PROOFS = [
  'meter',
  'try_start',
  'gauge',
  'temperature',
  'no_movement',
  'pin',
  'drained',
  'blind',
  'survey',
  'source_removed',
  'visual',
] as const;
export type LototoProof = (typeof LOTOTO_PROOFS)[number];

const PROOFS_FOR_ENERGY: Record<string, readonly LototoProof[]> = {
  electrical: ['meter', 'try_start'],
  pressure: ['gauge', 'try_start'],
  hydraulic: ['gauge', 'try_start'],
  pneumatic: ['gauge', 'try_start'],
  thermal: ['temperature'],
  mechanical: ['no_movement', 'pin'],
  gravity: ['no_movement', 'pin'],
  gravitational: ['no_movement', 'pin'],
  stored_energy: ['no_movement', 'pin'],
  chemical: ['drained', 'blind'],
  radiation: ['survey', 'source_removed'],
  other: ['visual'],
};

/** Proofs the field may use for this energy. An unknown tenant energy uses a visual check. */
export function proofsForEnergy(energyType: string): readonly LototoProof[] {
  return PROOFS_FOR_ENERGY[energyType] ?? ['visual'];
}
