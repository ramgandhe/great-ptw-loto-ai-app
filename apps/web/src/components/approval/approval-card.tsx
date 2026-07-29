import Link from "next/link";
import type { PendingApprovalItem } from "@/lib/approval/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export function ApprovalCard({ item }: { item: PendingApprovalItem }) {
  const { permit, step } = item;

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{permit.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {permit.reference ?? permit.id.slice(0, 8)} · Stage: {step.name}
          </p>
        </div>
        <PermitStatusBadge status={permit.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Submitted {permit.submittedAt ? new Date(permit.submittedAt).toLocaleString() : "—"}
        </p>
        <Link href={`/approvals/${permit.id}`}>
          <Button size="sm">Review</Button>
        </Link>
      </div>
    </article>
  );
}
