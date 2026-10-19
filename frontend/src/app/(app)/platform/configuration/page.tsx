"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { IndustriesPanel } from "./industries-panel";
import { PermitTypesPanel } from "./permit-types-panel";
import { LocationsPanel } from "./locations-panel";
import { AssetsPanel } from "./assets-panel";
import { HazardsPanel } from "./hazards-panel";
import { PpePanel, type PpeSection } from "./ppe-panel";
import { LototoPanel } from "./lototo-panel";

const TABS = [
  { value: "industries", label: "Industries" },
  { value: "permit-types", label: "Permit types" },
  { value: "locations", label: "Locations" },
  { value: "assets", label: "Assets" },
  { value: "hazards", label: "Hazards" },
  { value: "ppe", label: "PPE" },
  { value: "lototo", label: "LOTOTO" },
] as const;

type Tab = (typeof TABS)[number]["value"];

function isTab(value: string | null): value is Tab {
  return TABS.some((tab) => tab.value === value);
}

function AppConfiguration() {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("tab");
  const tab: Tab = isTab(requested) ? requested : "industries";
  const ppeSection: PpeSection = params.get("section") === "items" ? "items" : "categories";

  function setTab(next: Tab) {
    const section = next === "ppe" && ppeSection === "items" ? "&section=items" : "";
    router.replace(`/platform/configuration?tab=${next}${section}`, { scroll: false });
  }

  function setPpeSection(section: PpeSection) {
    router.replace(`/platform/configuration?tab=ppe${section === "items" ? "&section=items" : ""}`, { scroll: false });
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="App configuration"
        description="Defaults copied when a tenant is created. Tenants that already exist keep their own lists. Industries are shared, so an edit updates every tenant."
      />
      <SegmentedToggle label="App configuration" value={tab} onChange={setTab} options={[...TABS]} />
      {tab === "industries" ? <IndustriesPanel /> : null}
      {tab === "permit-types" ? <PermitTypesPanel /> : null}
      {tab === "locations" ? <LocationsPanel /> : null}
      {tab === "assets" ? <AssetsPanel /> : null}
      {tab === "hazards" ? <HazardsPanel /> : null}
      {tab === "ppe" ? <PpePanel section={ppeSection} onSectionChange={setPpeSection} /> : null}
      {tab === "lototo" ? <LototoPanel /> : null}
    </AdminPage>
  );
}

export default function AppConfigurationPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground sm:px-8">Loading…</p>}>
      <AppConfiguration />
    </Suspense>
  );
}
