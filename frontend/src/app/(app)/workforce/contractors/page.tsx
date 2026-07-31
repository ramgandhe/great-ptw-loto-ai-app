import { WorkforceCrudPage } from "@/components/workforce/workforce-crud-page";
import type { EntityField } from "@/lib/workforce/types";

const fields: EntityField[] = [
  { key: "name", label: "Contractor name", required: true },
  { key: "email", label: "Email" },
  { key: "agencyId", label: "Agency", select: "agency" },
  { key: "departmentId", label: "Department", select: "department" },
];

export default function ContractorsPage() {
  return (
    <WorkforceCrudPage
      title="Contractor management"
      description="Register contractors and link agencies."
      resource="contractors"
      fields={fields}
    />
  );
}
