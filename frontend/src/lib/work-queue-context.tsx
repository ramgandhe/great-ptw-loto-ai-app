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
  /** Sources that could not be read ("permits", "approvals", …): the queue is incomplete, never "all caught up". */
  failed: string[];
  retry: () => void;
};

const WorkQueueContext = createContext<WorkQueueValue>({ items: [], permits: [], counts: {}, loaded: false, failed: [], retry: () => undefined });

export function WorkQueueProvider({ children }: { children: React.ReactNode }) {
  const { roles, isLoading } = useAuthProfile();
  const pathname = usePathname();
  const [data, setData] = useState<{
    permits: PermitRecord[];
    approvals: PendingApprovalItem[];
    conflicts: SimopsConflict[];
    incidents: Incident[];
    failed: string[];
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Each fetch is gated on the roles the API accepts, so no one triggers a 403.
  // Refetch on every navigation so counts reflect the action just taken.
  useEffect(() => {
    if (isLoading || roles.length === 0) return;
    let cancelled = false;
    const failed: string[] = [];
    function read<T>(allowed: readonly string[], source: string, load: () => Promise<T[]>): Promise<T[]> {
      if (!hasAnyRole(roles, allowed)) return Promise.resolve([]);
      return load().catch(() => {
        failed.push(source);
        return [];
      });
    }
    Promise.all([
      read(PERMIT_READ_ROLES, "permits", listPermits),
      read(APPROVAL_READ_ROLES, "approvals", listPendingApprovals),
      read(SIMOPS_READ_ROLES, "work clashes", listSimopsConflicts),
      read(INCIDENT_READ_ROLES, "incidents", listIncidents),
    ]).then(([permits, approvals, conflicts, incidents]) => {
      if (!cancelled) setData({ permits, approvals, conflicts, incidents, failed });
    });
    return () => {
      cancelled = true;
    };
  }, [roles, isLoading, pathname, attempt]);

  const value = useMemo<WorkQueueValue>(() => {
    const retry = () => setAttempt((n) => n + 1);
    if (!data) return { items: [], permits: [], counts: {}, loaded: false, failed: [], retry };
    const items = buildWorkQueue(roles, data.permits, data.approvals, data.conflicts, data.incidents);
    return { items, permits: data.permits, counts: workCountsByRoute(items), loaded: true, failed: data.failed, retry };
  }, [data, roles]);

  return <WorkQueueContext.Provider value={value}>{children}</WorkQueueContext.Provider>;
}

export function useWorkQueue(): WorkQueueValue {
  return useContext(WorkQueueContext);
}
