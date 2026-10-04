import { Injectable } from '@nestjs/common';
import type { DbContext, Tx } from '../../database/context';
import { auditEvents } from '../../database/schema';

/** FR-AUD-005: per entity type, fields whose values never reach audit. A change is recorded as "changed". */
export const REDACTED_FIELDS: Record<string, readonly string[]> = {
  person: [
    'email', 'phone', 'blood_group', 'health_conditions', 'emergency_contacts', 'identity_document_number',
    'employment_history',
  ],
};

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
  const redacted = new Set(REDACTED_FIELDS[event.entityType] ?? []);
  const changes: Record<string, AuditChange> = {};
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[field]) === JSON.stringify(after[field])) continue;
    changes[field] = redacted.has(field) ? 'changed' : { before: before[field] ?? null, after: after[field] ?? null };
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
