import { EntityCrudPage } from "@/components/organisation/entity-crud-page";

const fields = [
  { key: "name", label: "Plant name", required: true },
  { key: "code", label: "Code" },
  { key: "description", label: "Description", multiline: true },
];

export default function PlantsPage() {
  return (
    <EntityCrudPage
      title="Plants"
      description="Manage top-level operational plants for the organisation."
      resource="plants"
      fields={fields}
    />
  );
}
