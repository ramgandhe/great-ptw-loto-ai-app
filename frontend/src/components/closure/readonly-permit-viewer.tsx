import { permitDetailToForm } from "@/lib/permit/form";
import type { PermitDetail } from "@/lib/permit/types";
import type { PermitClosure, PermitVerification } from "@/lib/closure/types";
import { PermitSummary } from "@/components/permit/permit-summary";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";

type ReadonlyPermitViewerProps = {
  detail: PermitDetail;
  verification?: PermitVerification | null;
  closure?: PermitClosure | null;
};

export function ReadonlyPermitViewer({
  detail,
  verification,
  closure,
}: ReadonlyPermitViewerProps) {
  const form = permitDetailToForm(detail);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{detail.permit.title}</h2>
        <PermitStatusBadge status={detail.permit.status} />
      </div>
      <PermitSummary form={form} status={detail.permit.status} reference={detail.permit.reference} />
      {verification ? (
        <section className="rounded-lg border border-border p-4 text-sm">
          <h3 className="font-semibold">Verification</h3>
          <p className="mt-1 text-muted-foreground">
            Verified {new Date(verification.verifiedAt).toLocaleString()}
          </p>
          {verification.comment ? <p className="mt-2">{verification.comment}</p> : null}
        </section>
      ) : null}
      {closure ? (
        <section className="rounded-lg border border-border p-4 text-sm">
          <h3 className="font-semibold">Closure</h3>
          <p className="mt-1 text-muted-foreground">
            Closed {new Date(closure.closedAt).toLocaleString()}
          </p>
          {closure.comment ? <p className="mt-2">{closure.comment}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
