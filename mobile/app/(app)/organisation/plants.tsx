import { RecordListScreen } from "@/components/record-list-screen";
import { loadPlantDirectory } from "@/lib/organisation/offline";

export default function PlantsDirectoryScreen() {
  return <RecordListScreen title="Plants" back={{ label: "Organisation", href: "/organisation" }} loader={loadPlantDirectory} details={(p) => [p.code, p.description]} />;
}
