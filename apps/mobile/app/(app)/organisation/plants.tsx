import { DirectoryListScreen } from "@/components/organisation/directory-list-screen";
import { loadPlantDirectory } from "@/lib/organisation/offline";

export default function PlantsDirectoryScreen() {
  return <DirectoryListScreen title="Plant directory" loader={loadPlantDirectory} />;
}
