import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import type { EntityField } from "@/lib/organisation/types";

const fields: EntityField[] = [
  { key: "name", label: "Location name", required: true },
  { key: "code", label: "Code" },
  // Locations belong to a department (FC-ORG-004); the department sets the plant.
  { key: "departmentId", label: "Department", select: "department" },
  { key: "description", label: "Description", multiline: true },
];

export default function LocationsPage() {
  return (
    <EntityCrudPage
      title="Locations"
      description="Manage operational work locations."
      resource="locations"
      fields={fields}
    />
  );
}
