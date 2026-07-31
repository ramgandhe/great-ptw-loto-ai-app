import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import type { EntityField } from "@/lib/organisation/types";

const fields: EntityField[] = [
  { key: "name", label: "Department name", required: true },
  { key: "code", label: "Code" },
  { key: "plantId", label: "Plant", select: "plant" },
  { key: "description", label: "Description", multiline: true },
];

export default function DepartmentsPage() {
  return (
    <EntityCrudPage
      title="Departments"
      description="Manage departments within the organisational hierarchy."
      resource="departments"
      fields={fields}
    />
  );
}
