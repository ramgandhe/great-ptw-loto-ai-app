import { RecordListScreen } from "@/components/record-list-screen";
import { loadCompetencies } from "@/lib/workforce/offline";

export default function CompetenciesScreen() {
  return <RecordListScreen title="Competencies" back={{ label: "Workforce", href: "/workforce" }} loader={loadCompetencies} details={(c) => [c.description]} />;
}
