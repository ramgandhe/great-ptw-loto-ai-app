"use client";

import { useState } from "react";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { IndustriesPanel } from "./industries-panel";
import { LocationsPanel } from "./locations-panel";
import { PermitTypesPanel } from "./permit-types-panel";
import { LototoPanel } from "./lototo-panel";
import { PpePanel } from "./ppe-panel";

type Tab = "industries" | "locations" | "permit-types" | "ppe" | "lototo";

export default function AppConfigurationPage() {
  const [tab, setTab] = useState<Tab>("industries");

  return (
    <AdminPage>
      <AdminPageHeader
        title="App configuration"
        description="Defaults copied when a tenant is created. Tenants that already exist keep their own lists."
      />
      <SegmentedToggle
        label="App configuration"
        value={tab}
        onChange={setTab}
        options={[
          { value: "industries", label: "Industries" },
          { value: "locations", label: "Locations" },
          { value: "permit-types", label: "Permit types" },
          { value: "ppe", label: "PPE" },
          { value: "lototo", label: "LOTOTO" },
        ]}
      />
      {tab === "industries" ? <IndustriesPanel /> : null}
      {tab === "locations" ? <LocationsPanel /> : null}
      {tab === "permit-types" ? <PermitTypesPanel /> : null}
      {tab === "ppe" ? <PpePanel /> : null}
      {tab === "lototo" ? <LototoPanel /> : null}
    </AdminPage>
  );
}
