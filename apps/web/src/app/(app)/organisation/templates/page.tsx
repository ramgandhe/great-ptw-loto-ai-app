import { EntityCrudPage } from "@/components/organisation/entity-crud-page";

const fields = [
  { key: "name", label: "Template name", required: true },
  { key: "code", label: "Code" },
  { key: "description", label: "Description", multiline: true },
];

export default function TemplatesPage() {
  return (
    <EntityCrudPage
      title="Permit templates"
      description="Publish and manage permit templates."
      resource="templates"
      fields={fields}
    />
  );
}
