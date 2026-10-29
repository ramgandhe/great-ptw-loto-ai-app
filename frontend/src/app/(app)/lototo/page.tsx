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
import {
  CERTIFICATE_WRITE_ROLES,
  certificateStatusLabel,
  listIsolationCertificates,
  type IsolationCertificateListRow,
} from "@/lib/lototo/certificates";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "isolated", label: "Isolated" },
  { value: "restoring", label: "Restoring" },
  { value: "finished", label: "Finished" },
];

function matchesFilter(status: string, filter: string) {
  if (filter === "open") return ["draft", "pending_approval", "approved", "isolation_in_progress"].includes(status);
  if (filter === "isolated") return status === "isolated_verified" || status === "sanction_for_test";
  if (filter === "restoring") return status === "restoration_in_progress";
  if (filter === "finished") return status === "restored_verified" || status === "closed";
  return true;
}

export default function LototoBoardPage() {
  const router = useRouter();
  const { roles } = useAuthProfile();
  const canWrite = hasAnyRole(roles, CERTIFICATE_WRITE_ROLES);
  const [rows, setRows] = useState<IsolationCertificateListRow[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listIsolationCertificates()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Isolations could not be loaded."));
  }, []);

  const visible = (rows ?? []).filter((row) => matchesFilter(row.certificate.status, filter));

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
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading isolations…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No isolations yet" : "Nothing in this view"}
          hint={canWrite && rows.length === 0 ? "Start from a published procedure. A permit is optional." : undefined}
        />
      ) : (
        <RecordList headers={["Isolation", "Place", "Status", ""]}>
          {visible.map((row, index) => (
            <RecordRow
              key={row.certificate.id}
              index={index}
              href={`/lototo/certificates/${row.certificate.id}`}
              title={row.certificate.title}
              reference={row.certificate.certificateNumber}
              context={row.assetName || row.locationName || "Location"}
              status={<span className="text-sm">{certificateStatusLabel(row.certificate.status)}</span>}
              action={<span className="text-sm text-muted-foreground">Open</span>}
            />
          ))}
        </RecordList>
      )}
    </main>
  );
}
