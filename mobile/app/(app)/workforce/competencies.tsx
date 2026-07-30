import { CompetencyListScreen } from "@/components/workforce/competency-list-screen";
import { loadCompetencies } from "@/lib/workforce/offline";

export default function CompetenciesScreen() {
  return <CompetencyListScreen title="Competencies" loader={loadCompetencies} />;
}
