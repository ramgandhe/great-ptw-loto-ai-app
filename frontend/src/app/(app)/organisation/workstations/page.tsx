import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import type { EntityField } from "@/lib/organisation/types";

const fields: EntityField[] = [
  { key: "name", label: "Workstation name", required: true },
  { key: "code", label: "Code", required: true },
  { key: "locationId", label: "Location", select: "location" },
  { key: "description", label: "Description", multiline: true },
];

export default function WorkstationsPage() {
  return (
    <EntityCrudPage
      title="Workstations"
      description="Kept from before work locations. Read only."
      resource="workstations"
      fields={fields}
      readOnly
    />
  );
}
