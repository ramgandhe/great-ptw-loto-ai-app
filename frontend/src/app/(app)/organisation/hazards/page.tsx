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
      description="The hazards permits choose from. Deactivate one to stop offering it without losing it from past permits."
      resource="hazards"
      fields={fields}
    />
  );
}
