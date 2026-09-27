"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PendingApprovalItem } from "@/lib/approval/types";
import { buttonVariants } from "@/components/ui/button";
import { formatRelative, formatWindow } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";

export function ApprovalCard({ item }: { item: PendingApprovalItem }) {
  const { permit, step } = item;
  const [lookups, setLookups] = useState<Lookups | null>(null);

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
  }, []);

  const type = lookups?.permitTypes.get(permit.permitTypeId);
  const place =
    nameOf(lookups?.machinery, permit.machineryId) ??
    nameOf(lookups?.workstations, permit.workstationId) ??
    nameOf(lookups?.locations, permit.locationId);

  return (
    <article className="relative flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card py-4 pl-6 pr-4">
      <span
        aria-hidden
        className="absolute inset-y-4 left-0 w-1 rounded-full bg-border"
        style={type?.color ? { backgroundColor: type.color } : undefined}
      />
      <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <h3 className="font-semibold">
          <Link href={`/approvals/${permit.id}`} className="hover:underline">
            {permit.title}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          {permit.reference ? <span className="font-mono text-xs leading-5">{permit.reference}</span> : null}
          {type ? <span>{type.name}</span> : null}
          {place ? <span>{place}</span> : null}
          <span>{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</span>
        </p>
      </div>
      <div className="text-sm">
        <p className="font-medium">{step.name}</p>
        <p className="text-xs text-muted-foreground">
          {permit.submittedAt ? `Waiting since ${formatRelative(permit.submittedAt)}` : "Not submitted"}
        </p>
      </div>
      <Link href={`/approvals/${permit.id}`} className={buttonVariants()}>
        Review
      </Link>
    </article>
  );
}
