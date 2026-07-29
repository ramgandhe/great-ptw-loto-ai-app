import { EntityCrudPage } from "@/components/organisation/entity-crud-page";

const fields = [
  { key: "name", label: "Workstation name", required: true },
  { key: "code", label: "Code" },
  { key: "locationId", label: "Location ID" },
  { key: "description", label: "Description", multiline: true },
];

export default function WorkstationsPage() {
  return (
    <EntityCrudPage
      title="Workstations"
      description="Manage workstations within locations."
      resource="workstations"
      fields={fields}
    />
  );
}
