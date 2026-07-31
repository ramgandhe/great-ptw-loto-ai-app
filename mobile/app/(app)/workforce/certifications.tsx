import { CompetencyListScreen } from "@/components/workforce/competency-list-screen";
import { loadCertifications } from "@/lib/workforce/offline";

export default function CertificationsScreen() {
  return <CompetencyListScreen title="Certifications" loader={loadCertifications} showExpiry />;
}
