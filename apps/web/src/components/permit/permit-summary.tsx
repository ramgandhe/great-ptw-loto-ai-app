import type { PermitFormState } from "@/lib/permit/types";
import { PermitStatusBadge } from "./permit-status-badge";

export function PermitSummary({
  form,
  status = "draft",
  reference,
}: {
  form: PermitFormState;
  status?: string;
  reference?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{form.title || "Untitled permit"}</h3>
        <PermitStatusBadge status={status} />
      </div>
      {reference ? (
        <p className="mb-3 text-sm text-muted-foreground">Reference: {reference}</p>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Permit type</dt>
          <dd className="font-medium">{form.permitTypeId || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Location</dt>
          <dd className="font-medium">{form.locationId || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Planned start</dt>
          <dd className="font-medium">{form.plannedStartAt || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Planned end</dt>
          <dd className="font-medium">{form.plannedEndAt || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Work scope</dt>
          <dd className="font-medium">{form.workScope || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Hazards</dt>
          <dd className="font-medium">
            {form.hazards.filter((h) => h.hazardCategoryId.trim()).length}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Executors</dt>
          <dd className="font-medium">
            {form.executors.filter((e) => e.workforceUserId.trim()).length}
          </dd>
        </div>
      </dl>
    </div>
  );
}
