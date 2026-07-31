import Link from "next/link";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

type PermitStatusCardProps = {
  permit: PermitRecord;
  subtitle?: string;
};

export function PermitStatusCard({ permit, subtitle }: PermitStatusCardProps) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-semibold">{permit.title}</h3>
            <PermitStatusBadge status={permit.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {permit.reference ?? permit.id.slice(0, 8)}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
          {permit.plannedStartAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Planned {new Date(permit.plannedStartAt).toLocaleString()}
              {permit.plannedEndAt
                ? ` – ${new Date(permit.plannedEndAt).toLocaleString()}`
                : ""}
            </p>
          ) : null}
        </div>
        <Link href={`/execution/${permit.id}`}>
          <Button variant="outline" size="sm">
            {permit.status === "approved" ? "Activate" : "Open"}
          </Button>
        </Link>
      </div>
    </article>
  );
}
