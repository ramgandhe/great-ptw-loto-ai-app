import { Injectable } from '@nestjs/common';
import type { DbContext, Tx } from '../../database/context';
import { auditEvents } from '../../database/schema';

/**
 * FR-AUD-005: fields whose values never reach audit. A change is recorded as "changed". Redaction fails closed:
 * the union of these names applies to every entity type, to camelCase spellings, and to any field that holds
 * one at any depth. Add the names of a new kind of personal value here.
 */
export const REDACTED_FIELDS: Record<string, readonly string[]> = {
  person: [
    'email', 'phone', 'blood_group', 'health_conditions', 'emergency_contacts', 'identity_document_number',
    'employment_history',
  ],
};

const REDACTED = new Set(Object.values(REDACTED_FIELDS).flat());
const isRedacted = (key: string): boolean => REDACTED.has(key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase());
const holdsRedacted = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && Object.entries(value).some(([key, v]) => isRedacted(key) || holdsRedacted(v));

export type AuditChange = { before: unknown; after: unknown } | 'changed';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  legalEntityId?: string;
  onBehalfOfPersonId?: string;
  deviceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Fields that changed but whose values the caller does not pass. Always recorded as "changed". */
  changedFields?: readonly string[];
}

export function auditChanges(
  event: Pick<AuditEvent, 'entityType' | 'before' | 'after' | 'changedFields'>,
): Record<string, AuditChange> {
  const before = event.before ?? {};
  const after = event.after ?? {};
  const changes: Record<string, AuditChange> = {};
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const [was, now] = [before[field] ?? null, after[field] ?? null];
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    changes[field] = isRedacted(field) || holdsRedacted(was) || holdsRedacted(now) ? 'changed' : { before: was, after: now };
  }
  for (const field of event.changedFields ?? []) changes[field] = 'changed';
  return changes;
}

/** Writes in the caller's transaction: if the action rolls back, its audit event does too (FR-AUD-001 to 003). */
@Injectable()
export class AuditWriter {
  async record(tx: Tx, ctx: DbContext, event: AuditEvent): Promise<void> {
    if (!ctx.tenantId) throw new Error('An audit event needs a tenant context');
    await tx.insert(auditEvents).values({
      tenantId: ctx.tenantId,
      legalEntityId: event.legalEntityId ?? null,
      actorPersonId: ctx.personId,
      onBehalfOfPersonId: event.onBehalfOfPersonId ?? null,
      deviceId: event.deviceId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      changes: auditChanges(event),
    });
  }
}
