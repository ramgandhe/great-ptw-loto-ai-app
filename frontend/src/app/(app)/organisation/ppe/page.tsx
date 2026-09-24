import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import type { EntityField } from "@/lib/organisation/types";

const PPE_CATEGORY_OPTIONS = [
  { value: "head", label: "Head" },
  { value: "eye", label: "Eye" },
  { value: "hearing", label: "Hearing" },
  { value: "respiratory", label: "Respiratory" },
  { value: "hand", label: "Hand" },
  { value: "foot", label: "Foot" },
  { value: "body", label: "Body" },
  { value: "fall-protection", label: "Fall protection" },
  { value: "other", label: "Other" },
];

const fields: EntityField[] = [
  { key: "name", label: "PPE item", required: true },
  { key: "code", label: "Code", required: true },
  {
    key: "category",
    label: "Category",
    required: true,
    options: PPE_CATEGORY_OPTIONS,
  },
  { key: "description", label: "Description", multiline: true },
];

export default function PpePage() {
  return (
    <EntityCrudPage
      title="PPE configuration"
      description="Configure organisation PPE requirements."
      resource="ppe"
      fields={fields}
    />
  );
}
