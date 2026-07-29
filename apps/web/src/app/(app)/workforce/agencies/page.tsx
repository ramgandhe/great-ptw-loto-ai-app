import { WorkforceCrudPage } from "@/components/workforce/workforce-crud-page";

const fields = [
  { key: "name", label: "Agency name", required: true },
  { key: "email", label: "Contact email" },
  { key: "phone", label: "Contact phone" },
];

export default function AgenciesPage() {
  return (
    <WorkforceCrudPage
      title="Agency management"
      description="Register contractor agencies."
      resource="agencies"
      fields={fields}
    />
  );
}
