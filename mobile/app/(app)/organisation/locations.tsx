import { RecordListScreen } from "@/components/record-list-screen";
import { loadLocationDirectory } from "@/lib/organisation/offline";

export default function LocationsDirectoryScreen() {
  return <RecordListScreen title="Locations" back={{ label: "Organisation", href: "/organisation" }} loader={loadLocationDirectory} details={(l) => [l.code, l.description]} />;
}
