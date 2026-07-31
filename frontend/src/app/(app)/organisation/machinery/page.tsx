import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import type { EntityField } from "@/lib/organisation/types";

const fields: EntityField[] = [
  { key: "name", label: "Machinery name", required: true },
  { key: "code", label: "Code" },
  { key: "workstationId", label: "Workstation", select: "workstation" },
  { key: "description", label: "Description", multiline: true },
];

export default function MachineryPage() {
  return (
    <EntityCrudPage
      title="Machinery"
      description="Manage machinery linked to workstations."
      resource="machinery"
      fields={fields}
    />
  );
}
