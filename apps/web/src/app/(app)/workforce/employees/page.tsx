import { WorkforceCrudPage } from "@/components/workforce/workforce-crud-page";

const fields = [
  { key: "name", label: "Full name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "departmentId", label: "Department ID" },
];

export default function EmployeesPage() {
  return (
    <WorkforceCrudPage
      title="Employee management"
      description="Register and manage employees."
      resource="employees"
      fields={fields}
    />
  );
}
