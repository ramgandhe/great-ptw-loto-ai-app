import { EntityCrudPage } from "@/components/organisation/entity-crud-page";

const fields = [
  { key: "name", label: "Checklist name", required: true },
  { key: "code", label: "Code" },
  { key: "description", label: "Description", multiline: true },
];

export default function ChecklistsPage() {
  return (
    <EntityCrudPage
      title="Safety checklists"
      description="Configure reusable safety checklists."
      resource="checklists"
      fields={fields}
    />
  );
}
