import { WorkforceListScreen } from "@/components/workforce/workforce-list-screen";
import { loadWorkforceDirectory } from "@/lib/workforce/offline";

export default function WorkforceDirectoryScreen() {
  return <WorkforceListScreen title="Workforce directory" loader={loadWorkforceDirectory} />;
}
