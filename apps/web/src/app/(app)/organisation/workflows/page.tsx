import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import { approvalWorkflowsApi } from "@/lib/organisation/api";

const fields = [
  { key: "name", label: "Workflow name", required: true },
  { key: "code", label: "Code" },
  { key: "description", label: "Description", multiline: true },
];

export default function WorkflowsPage() {
  return (
    <EntityCrudPage
      title="Approval workflows"
      description="Configure organisation approval workflow stages."
      api={approvalWorkflowsApi}
      fields={fields}
    />
  );
}
