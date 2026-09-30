"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { AdminEmbedContext } from "@/components/layout/admin-page-header";
import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import { machineryApi } from "@/lib/organisation/api";
import { listLototoProcedures } from "@/lib/lototo/api";
import type { LototoProcedureListItem } from "@/lib/lototo/types";
import type { EntityField, OrgRecord } from "@/lib/organisation/types";

const fields: EntityField[] = [
  { key: "name", label: "Machinery name", required: true },
  { key: "code", label: "Code" },
  { key: "workstationId", label: "Workstation", select: "workstation" },
  { key: "description", label: "Description", multiline: true },
];

export default function MachineryPage() {
  return (
    <>
      <EntityCrudPage
        title="Machinery"
        description="Manage machinery linked to workstations. LOTOTO procedures for each machine are listed below."
        resource="machinery"
        fields={fields}
      />
      <MachineryLototoList />
    </>
  );
}

function MachineryLototoList() {
  const [machinery, setMachinery] = useState<OrgRecord[]>([]);
  const [procedures, setProcedures] = useState<LototoProcedureListItem[]>([]);

  useEffect(() => {
    machineryApi.list().then(setMachinery).catch(() => setMachinery([]));
    listLototoProcedures().then(setProcedures).catch(() => setProcedures([]));
  }, []);

  return (
    <section className={useContext(AdminEmbedContext) ? "" : "px-4 pb-8 sm:px-8"}>
      <h2 className="mb-3 text-sm font-semibold">LOTOTO by machinery</h2>
      {machinery.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add machinery above, then attach LOTOTO procedures.</p>
      ) : (
        <div className="grid gap-3">
          {machinery.map((item) => {
            const itemProcedures = procedures.filter((row) => row.machineryId === item.id);
            return (
              <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{item.name}</h3>
                  <Link href={`/lototo/procedures/new?machineryId=${item.id}`}>
                    <span className="text-sm text-primary underline">Add LOTOTO</span>
                  </Link>
                </div>
                {itemProcedures.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No LOTOTO procedures yet.</p>
                ) : (
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {itemProcedures.map((row) => (
                      <li key={row.id}>
                        <Link href={`/lototo/procedures/${row.id}`} className="underline">
                          {row.code} — {row.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
