import { EntityCrudPage } from "@/components/organisation/entity-crud-page";

const fields = [
  { key: "name", label: "Department name", required: true },
  { key: "code", label: "Code" },
  { key: "plantId", label: "Plant ID" },
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
