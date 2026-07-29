import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import { machineryApi } from "@/lib/organisation/api";

const fields = [
  { key: "name", label: "Machinery name", required: true },
  { key: "code", label: "Code" },
  { key: "workstationId", label: "Workstation ID" },
  { key: "description", label: "Description", multiline: true },
];

export default function MachineryPage() {
  return (
    <EntityCrudPage
      title="Machinery"
      description="Manage machinery linked to workstations."
      api={machineryApi}
      fields={fields}
    />
  );
}
