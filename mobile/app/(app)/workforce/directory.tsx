import { RecordListScreen } from "@/components/record-list-screen";
import { loadWorkforceDirectory } from "@/lib/workforce/offline";

export default function WorkforceDirectoryScreen() {
  return <RecordListScreen title="People" description="Everyone in the organisation's workforce." back={{ label: "Workforce", href: "/workforce" }} loader={loadWorkforceDirectory} details={(p) => [p.role, p.email, p.phone]} />;
}
