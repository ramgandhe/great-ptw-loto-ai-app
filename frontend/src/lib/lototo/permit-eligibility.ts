import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";

export const LOTOTO_ELIGIBLE_PERMIT_STATUSES = ["approved", "active", "suspended"] as const;

export async function listLototoEligiblePermits(): Promise<PermitRecord[]> {
  const groups = await Promise.all(
    LOTOTO_ELIGIBLE_PERMIT_STATUSES.map((status) =>
      listPermits(status).catch(() => [] as PermitRecord[]),
    ),
  );

  const byId = new Map<string, PermitRecord>();
  for (const group of groups) {
    for (const permit of group) {
      byId.set(permit.id, permit);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}
