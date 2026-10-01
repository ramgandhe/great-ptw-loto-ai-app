"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { AdminEmbedContext, AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { WorkforceOpenAddContext } from "@/components/workforce/workforce-crud-page";
import EmployeesPage from "../employees/page";
import ContractorsPage from "../contractors/page";

type View = "everyone" | "employees" | "contractors";

/** People: everyone in one list, with employees and contractors added and edited here as distinct records. */
export default function WorkforceDirectoryPage() {
  const [items, setItems] = useState<WorkforceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("everyone");
  // Which list opens with its add form, when the person chose Add from the Everyone view.
  const [openAdd, setOpenAdd] = useState<"employees" | "contractors" | null>(null);

  useEffect(() => {
    if (view !== "everyone") return;
    listWorkforceDirectory()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load directory"));
  }, [view]);

  const show = (next: View, add: "employees" | "contractors" | null = null) => {
    setOpenAdd(add);
    setView(next);
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="People"
        description="Everyone on the workforce. Employees and contractors stay separate records; add or edit them here."
        action={
          view === "everyone" ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="lg" className="min-h-11" onClick={() => show("employees", "employees")}>
                <Plus aria-hidden />
                Add employee
              </Button>
              <Button type="button" size="lg" variant="outline" className="min-h-11" onClick={() => show("contractors", "contractors")}>
                <Plus aria-hidden />
                Add contractor
              </Button>
            </div>
          ) : null
        }
      >
        <SegmentedToggle
          label="Show"
          value={view}
          onChange={(next) => show(next)}
          options={[
            { value: "everyone", label: "Everyone" },
            { value: "employees", label: "Employees" },
            { value: "contractors", label: "Contractors" },
          ]}
        />
      </AdminPageHeader>

      {view === "everyone" ? (
        <>
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
                      <RowActions actions={[{ label: "Manage", onClick: () => show(item.role === "contractor" ? "contractors" : "employees") }]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <AdminEmbedContext.Provider value={true}>
          <WorkforceOpenAddContext.Provider value={openAdd}>
            {view === "employees" ? <EmployeesPage /> : <ContractorsPage />}
          </WorkforceOpenAddContext.Provider>
        </AdminEmbedContext.Provider>
      )}
    </AdminPage>
  );
}
