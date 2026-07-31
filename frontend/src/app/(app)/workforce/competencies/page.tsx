import { WorkforceCrudPage } from "@/components/workforce/workforce-crud-page";
import type { EntityField } from "@/lib/workforce/types";

const fields: EntityField[] = [
  { key: "name", label: "Competency name", required: true },
  { key: "workforceUserId", label: "Workforce member", select: "workforce" },
  { key: "description", label: "Description" },
];

export default function CompetenciesPage() {
  return (
    <WorkforceCrudPage
      title="Competencies"
      description="Maintain workforce competency records."
      resource="competencies"
      fields={fields}
    />
  );
}
