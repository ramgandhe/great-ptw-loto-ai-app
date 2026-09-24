"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import { machineryApi } from "@/lib/organisation/api";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
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
  const [plans, setPlans] = useState<LototoPlan[]>([]);

  useEffect(() => {
    machineryApi.list().then(setMachinery).catch(() => setMachinery([]));
    listLototoPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  return (
    <section className="px-8 pb-8">
      <h2 className="mb-3 text-sm font-semibold">LOTOTO by machinery</h2>
      {machinery.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add machinery above, then attach LOTOTO procedures.</p>
      ) : (
        <div className="grid gap-3">
          {machinery.map((item) => {
            const itemPlans = plans.filter((plan) => plan.machineryId === item.id);
            return (
              <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{item.name}</h3>
                  <Link href={`/lototo/plans/new?machineryId=${item.id}`}>
                    <span className="text-sm text-primary underline">Add LOTOTO</span>
                  </Link>
                </div>
                {itemPlans.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No LOTOTO procedures yet.</p>
                ) : (
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {itemPlans.map((plan) => (
                      <li key={plan.id}>
                        <Link href={`/lototo/plans/${plan.id}`} className="underline">
                          {plan.title}
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
