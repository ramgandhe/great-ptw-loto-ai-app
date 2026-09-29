"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RowActions } from "@/components/ui/row-actions";
import { ApiError } from "@/lib/api";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";

export default function WorkforceDirectoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<WorkforceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWorkforceDirectory()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load directory"));
  }, []);

  return (
    <AdminPage>
      <AdminPageHeader title="Workforce directory" description="Everyone on the workforce. Edit or delete a person on their Employees or Contractors list." />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="table-box">
      <table className="min-w-full text-sm">
        <thead className="table-tone text-left text-xs">
          <tr>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Email</th>
            <th className="px-4 py-2.5">Phone</th>
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5"><span className="sr-only">Manage</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="row-hover border-t border-border">
              <td className="px-4 py-3">{item.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.email ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.phone ?? "—"}</td>
              <td className="px-4 py-3">{item.role ?? "—"}</td>
              <td className="px-4 py-3"><OrgStatusBadge status={item.status} /></td>
              <td className="px-4 py-3">
                <RowActions actions={[{ label: "Manage", onClick: () => router.push(item.role === "contractor" ? "/workforce/contractors" : "/workforce/employees") }]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </AdminPage>
  );
}
