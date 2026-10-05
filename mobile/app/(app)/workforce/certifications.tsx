import { RecordListScreen } from "@/components/record-list-screen";
import { formatDate } from "@/lib/format";
import { loadCertifications } from "@/lib/workforce/offline";

export default function CertificationsScreen() {
  return (
    <RecordListScreen
      title="Certifications"
      back={{ label: "Workforce", href: "/workforce" }}
      loader={loadCertifications}
      details={(c) => [c.expiryDate ? `Expires ${formatDate(c.expiryDate)}` : null, c.description]}
    />
  );
}
