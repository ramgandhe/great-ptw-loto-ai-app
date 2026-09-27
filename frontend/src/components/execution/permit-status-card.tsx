"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatWindow } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import { cn } from "@/lib/utils";

export function PermitStatusCard({ permit, overdue = false }: { permit: PermitRecord; overdue?: boolean }) {
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
      <span aria-hidden className="absolute inset-y-4 left-0 w-1 rounded-full bg-border" style={type?.color ? { backgroundColor: type.color } : undefined} />
      <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/execution/${permit.id}`} className="font-semibold hover:underline">
            {permit.title}
          </Link>
          <PermitStatusBadge status={permit.status} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          {permit.reference ? <span className="font-mono text-xs leading-5">{permit.reference}</span> : null}
          {type ? <span>{type.name}</span> : null}
          {place ? <span>{place}</span> : null}
          <span>{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</span>
        </p>
      </div>
      {overdue ? (
        <span className="flex items-center gap-1 text-sm font-medium text-(--status-danger)">
          <TriangleAlert className="size-4" aria-hidden />
          Past planned end
        </span>
      ) : null}
      <Link
        href={`/execution/${permit.id}`}
        className={cn(buttonVariants({ variant: permit.status === "approved" || overdue ? "default" : "outline" }), "ml-auto")}
      >
        {permit.status === "approved" ? "Start work" : permit.status === "suspended" ? "Review" : "Open"}
      </Link>
    </article>
  );
}
