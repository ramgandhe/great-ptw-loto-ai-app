import { UUID_PATTERN } from '../../database/context';

/** NFR-SEC-008: a job payload carries the tenant ID and record IDs only, never names, contact or health data. */
export type TenantJobPayload = { tenantId: string } & Record<string, string>;

export function assertIdsOnly(payload: Record<string, unknown>): asserts payload is TenantJobPayload {
  if (typeof payload.tenantId !== 'string') throw new Error('A job payload needs tenantId');
  for (const [field, value] of Object.entries(payload)) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new Error(`Job payload field "${field}" must be a record ID`);
    }
  }
}
