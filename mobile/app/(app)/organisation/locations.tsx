import { DirectoryListScreen } from "@/components/organisation/directory-list-screen";
import { loadLocationDirectory } from "@/lib/organisation/offline";

export default function LocationsDirectoryScreen() {
  return <DirectoryListScreen title="Location directory" loader={loadLocationDirectory} />;
}
