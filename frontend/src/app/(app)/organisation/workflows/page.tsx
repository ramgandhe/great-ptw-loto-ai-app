import { EntityCrudPage } from "@/components/organisation/entity-crud-page";

const fields = [
  { key: "name", label: "Workflow name", required: true },
  { key: "code", label: "Code" },
  { key: "description", label: "Description", multiline: true },
  {
    key: "approverRole",
    label: "Approver",
    required: true,
    options: [
      { value: "permit-approver", label: "Permit approver" },
      { value: "permit-receiver", label: "Permit receiver" },
      { value: "safety-officer", label: "Safety officer" },
    ],
  },
];

export default function WorkflowsPage() {
  return (
    <EntityCrudPage
      title="Approval workflows"
      description="One current workflow at a time. Activate a row to use its approver for permit submission."
      resource="workflows"
      fields={fields}
    />
  );
}
