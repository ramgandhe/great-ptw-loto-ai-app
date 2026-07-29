import { WorkforceCrudPage } from "@/components/workforce/workforce-crud-page";
import { contractorsApi } from "@/lib/workforce/api";

const fields = [
  { key: "name", label: "Contractor name", required: true },
  { key: "email", label: "Email" },
  { key: "agencyId", label: "Agency ID" },
  { key: "departmentId", label: "Department ID" },
];

export default function ContractorsPage() {
  return (
    <WorkforceCrudPage
      title="Contractor management"
      description="Register contractors and link agencies."
      api={contractorsApi}
      fields={fields}
    />
  );
}
