"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { listPendingApprovals } from "@/lib/approval/api";
import { listIncidents } from "@/lib/incidents/api";
import type { Incident } from "@/lib/incidents/types";
import { listSimopsConflicts } from "@/lib/simops/api";
import type { SimopsConflict } from "@/lib/simops/types";
import type { PendingApprovalItem } from "@/lib/approval/types";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { APPROVAL_READ_ROLES, INCIDENT_READ_ROLES, PERMIT_READ_ROLES, SIMOPS_READ_ROLES } from "@/lib/auth/roles";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { buildWorkQueue, workCountsByRoute, type WorkItem } from "@/lib/work-queue";

type WorkQueueValue = {
  items: WorkItem[];
  /** Every permit the user can see, shared with search and lists. */
  permits: PermitRecord[];
  counts: Record<string, number>;
  loaded: boolean;
};

const WorkQueueContext = createContext<WorkQueueValue>({ items: [], permits: [], counts: {}, loaded: false });

export function WorkQueueProvider({ children }: { children: React.ReactNode }) {
  const { roles, isLoading } = useAuthProfile();
  const pathname = usePathname();
  const [data, setData] = useState<{
    permits: PermitRecord[];
    approvals: PendingApprovalItem[];
    conflicts: SimopsConflict[];
    incidents: Incident[];
  } | null>(null);

  // Each fetch is gated on the roles the API accepts, so no one triggers a 403.
  // Refetch on every navigation so counts reflect the action just taken.
  useEffect(() => {
    if (isLoading || roles.length === 0) return;
    let cancelled = false;
    Promise.all([
      hasAnyRole(roles, PERMIT_READ_ROLES)
        ? listPermits().catch(() => [] as PermitRecord[])
        : Promise.resolve([] as PermitRecord[]),
      hasAnyRole(roles, APPROVAL_READ_ROLES)
        ? listPendingApprovals().catch(() => [] as PendingApprovalItem[])
        : Promise.resolve([] as PendingApprovalItem[]),
      hasAnyRole(roles, SIMOPS_READ_ROLES)
        ? listSimopsConflicts().catch(() => [] as SimopsConflict[])
        : Promise.resolve([] as SimopsConflict[]),
      hasAnyRole(roles, INCIDENT_READ_ROLES)
        ? listIncidents().catch(() => [] as Incident[])
        : Promise.resolve([] as Incident[]),
    ]).then(([permits, approvals, conflicts, incidents]) => {
      if (!cancelled) setData({ permits, approvals, conflicts, incidents });
    });
    return () => {
      cancelled = true;
    };
  }, [roles, isLoading, pathname]);

  const value = useMemo<WorkQueueValue>(() => {
    if (!data) return { items: [], permits: [], counts: {}, loaded: false };
    const items = buildWorkQueue(roles, data.permits, data.approvals, data.conflicts, data.incidents);
    return { items, permits: data.permits, counts: workCountsByRoute(items), loaded: true };
  }, [data, roles]);

  return <WorkQueueContext.Provider value={value}>{children}</WorkQueueContext.Provider>;
}

export function useWorkQueue(): WorkQueueValue {
  return useContext(WorkQueueContext);
}
