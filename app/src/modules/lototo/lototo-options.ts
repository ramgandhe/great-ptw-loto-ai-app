import { eq } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { Database } from '../../database/database.module';
import { lototoTenantOptions } from '../../database/schema';

export type LototoTenantOptions = {
  requireEvidencePhoto: boolean;
  requireDistinctProver: boolean;
  requireSecondApprovalBeforeIsolate: boolean;
};

const DEFAULTS: LototoTenantOptions = {
  requireEvidencePhoto: false,
  requireDistinctProver: false,
  requireSecondApprovalBeforeIsolate: false,
};

export async function loadLototoOptions(
  db: Pick<Database, 'select'>,
  tenantId: string,
): Promise<LototoTenantOptions> {
  const [row] = await db
    .select()
    .from(lototoTenantOptions)
    .where(eq(lototoTenantOptions.tenantId, tenantId));
  if (!row) return { ...DEFAULTS };
  return {
    requireEvidencePhoto: row.requireEvidencePhoto,
    requireDistinctProver: row.requireDistinctProver,
    requireSecondApprovalBeforeIsolate: row.requireSecondApprovalBeforeIsolate,
  };
}

export async function saveLototoOptions(
  db: Pick<Database, 'select' | 'insert' | 'update'>,
  tenantId: string,
  patch: Partial<LototoTenantOptions>,
  userId: string,
): Promise<LototoTenantOptions> {
  const current = await loadLototoOptions(db, tenantId);
  const next: LototoTenantOptions = {
    requireEvidencePhoto: patch.requireEvidencePhoto ?? current.requireEvidencePhoto,
    requireDistinctProver: patch.requireDistinctProver ?? current.requireDistinctProver,
    requireSecondApprovalBeforeIsolate:
      patch.requireSecondApprovalBeforeIsolate ?? current.requireSecondApprovalBeforeIsolate,
  };
  const [existing] = await db
    .select({ tenantId: lototoTenantOptions.tenantId })
    .from(lototoTenantOptions)
    .where(eq(lototoTenantOptions.tenantId, tenantId));
  if (existing) {
    await db
      .update(lototoTenantOptions)
      .set({
        ...next,
        updatedBy: optionalUuid(userId),
        updatedAt: new Date(),
      })
      .where(eq(lototoTenantOptions.tenantId, tenantId));
  } else {
    await db.insert(lototoTenantOptions).values({
      tenantId,
      ...next,
      createdBy: optionalUuid(userId),
      updatedBy: optionalUuid(userId),
    });
  }
  return next;
}
