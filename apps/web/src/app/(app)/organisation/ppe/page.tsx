import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import { ppeConfigurationsApi } from "@/lib/organisation/api";

const fields = [
  { key: "name", label: "PPE item", required: true },
  { key: "code", label: "Code" },
  { key: "description", label: "Description", multiline: true },
];

export default function PpePage() {
  return (
    <EntityCrudPage
      title="PPE configuration"
      description="Configure organisation PPE requirements."
      api={ppeConfigurationsApi}
      fields={fields}
    />
  );
}
