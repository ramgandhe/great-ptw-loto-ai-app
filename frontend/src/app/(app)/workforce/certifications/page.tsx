import { WorkforceCrudPage } from "@/components/workforce/workforce-crud-page";
import type { EntityField } from "@/lib/workforce/types";

const fields: EntityField[] = [
  { key: "name", label: "Certification name", required: true },
  { key: "workforceUserId", label: "Workforce member", select: "workforce", required: true },
  { key: "expiryDate", label: "Expiry date (YYYY-MM-DD)" },
  { key: "description", label: "Notes" },
];

export default function CertificationsPage() {
  return (
    <WorkforceCrudPage
      title="Certifications"
      description="Track workforce certifications and expiry dates."
      resource="certifications"
      fields={fields}
    />
  );
}
