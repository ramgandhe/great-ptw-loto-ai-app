"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorNote, RecordList, RecordRow } from "@/components/safety/record-list";
import { AppSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { LOTOTO_OPTIONS_WRITE_ROLES } from "@/lib/auth/roles";
import {
  CERTIFICATE_WRITE_ROLES,
  certificateStatusLabel,
  getLototoOptions,
  listIsolationCertificates,
  saveLototoOptions,
  type IsolationCertificateListRow,
  type LototoTenantOptions,
} from "@/lib/lototo/certificates";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "isolated", label: "Isolated" },
  { value: "under_test", label: "Under test" },
  { value: "long_term", label: "Long-term" },
  { value: "walk_due", label: "Walk overdue" },
  { value: "restoring", label: "Restoring" },
  { value: "finished", label: "Finished" },
];

function matchesFilter(row: IsolationCertificateListRow, filter: string) {
  const status = row.certificate.status;
  if (filter === "open") return ["draft", "pending_approval", "approved", "isolation_in_progress"].includes(status);
  if (filter === "isolated") return status === "isolated_verified" || status === "sanction_for_test";
  if (filter === "under_test") return Boolean(row.underTest) || status === "sanction_for_test";
  if (filter === "long_term") return Boolean(row.certificate.isLongTerm);
  if (filter === "walk_due") return Boolean(row.walkOverdue);
  if (filter === "restoring") return status === "restoration_in_progress";
  if (filter === "finished") return status === "restored_verified" || status === "closed";
  return true;
}

function boardBadges(row: IsolationCertificateListRow) {
  const parts: string[] = [];
  if (row.certificate.isLongTerm) parts.push(row.walkOverdue ? "Long-term · walk overdue" : "Long-term");
  if (row.underTest || row.certificate.status === "sanction_for_test") parts.push("Under test");
  if ((row.attachedPermitCount ?? 0) > 1) parts.push(`${row.attachedPermitCount} permits`);
  else if (row.attachedPermitCount === 1) parts.push("1 permit");
  return parts;
}

export default function LototoBoardPage() {
  const router = useRouter();
  const { roles } = useAuthProfile();
  const canWrite = hasAnyRole(roles, CERTIFICATE_WRITE_ROLES);
  const canEditSiteRules = hasAnyRole(roles, LOTOTO_OPTIONS_WRITE_ROLES);
  const [rows, setRows] = useState<IsolationCertificateListRow[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<LototoTenantOptions | null>(null);
  const [optionsBusy, setOptionsBusy] = useState(false);

  useEffect(() => {
    listIsolationCertificates()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Isolations could not be loaded."));
    if (canEditSiteRules) {
      getLototoOptions()
        .then(setOptions)
        .catch(() => setOptions(null));
    }
  }, [canEditSiteRules]);

  const visible = (rows ?? []).filter((row) => matchesFilter(row, filter));

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        title="Isolations"
        description="Each certificate is one isolation. It can stand on its own, and a permit can use it later."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/lototo/procedures")}>
              Procedures
            </Button>
            {canWrite ? (
              <Button type="button" size="lg" onClick={() => router.push("/lototo/certificates/new")}>
                <Plus aria-hidden />
                New isolation
              </Button>
            ) : null}
          </div>
        }
      >
        <AppSelect className="w-44" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter isolations">
          {FILTERS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </AppSelect>
      </PageHeader>
      <ErrorNote message={error} />
      {canEditSiteRules && options ? (
        <section className="grid max-w-3xl gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Site LOTOTO rules</h2>
          <p className="text-sm text-muted-foreground">All switches default off. Turn on only when the site rule requires it.</p>
          {(
            [
              ["requireEvidencePhoto", "Require evidence photo on apply, pass proof, and restore"],
              ["requireDistinctProver", "Prover must differ from the person who applied the lock"],
              ["requireSecondApprovalBeforeIsolate", "Second authorised approval before isolation starts"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={options[key]}
                disabled={optionsBusy}
                onChange={(event) => {
                  const next = { ...options, [key]: event.target.checked };
                  setOptions(next);
                  setOptionsBusy(true);
                  void saveLototoOptions({ [key]: event.target.checked })
                    .then(setOptions)
                    .catch((err) => setError(err instanceof ApiError ? err.message : "Could not save site rules."))
                    .finally(() => setOptionsBusy(false));
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </section>
      ) : null}
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading isolations…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No isolations yet" : "Nothing in this view"}
          hint={canWrite && rows.length === 0 ? "Start from a published procedure. A permit is optional." : undefined}
        />
      ) : (
        <RecordList headers={["Isolation", "Place", "Status", ""]}>
          {visible.map((row, index) => {
            const badges = boardBadges(row);
            return (
            <RecordRow
              key={row.certificate.id}
              index={index}
              href={`/lototo/certificates/${row.certificate.id}`}
              title={row.certificate.title}
              reference={row.certificate.certificateNumber}
              context={[row.assetName || row.locationName || "Location", ...badges].join(" · ")}
              status={<span className="text-sm">{certificateStatusLabel(row.certificate.status)}</span>}
              action={<span className="text-sm text-muted-foreground">Open</span>}
            />
            );
          })}
        </RecordList>
      )}
    </main>
  );
}
