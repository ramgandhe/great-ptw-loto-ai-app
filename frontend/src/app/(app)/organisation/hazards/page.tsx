import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import type { EntityField } from "@/lib/organisation/types";

const HAZARD_SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const fields: EntityField[] = [
  { key: "name", label: "Hazard", required: true },
  { key: "code", label: "Code", required: true },
  {
    key: "severity",
    label: "Severity",
    required: true,
    options: HAZARD_SEVERITY_OPTIONS,
  },
  { key: "description", label: "Description", multiline: true },
];

export default function HazardsPage() {
  return (
    <EntityCrudPage
      title="Hazard Configuration"
      description="Configure hazard categories for this organisation. Owner and Admin can add, edit, and archive hazards."
      resource="hazards"
      fields={fields}
    />
  );
}
