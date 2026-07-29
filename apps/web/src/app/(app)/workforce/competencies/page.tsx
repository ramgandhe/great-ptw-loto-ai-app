import { WorkforceCrudPage } from "@/components/workforce/workforce-crud-page";

const fields = [
  { key: "name", label: "Competency name", required: true },
  { key: "workforceUserId", label: "Workforce user ID" },
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
