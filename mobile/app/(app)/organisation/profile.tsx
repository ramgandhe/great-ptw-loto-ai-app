import { useEffect, useState } from "react";
import { Card, EmptyState, InfoList, PageHeader, Screen, ScreenState } from "@/components/ui";
import { loadOrganisationProfile } from "@/lib/organisation/offline";
import type { Organisation } from "@/lib/organisation/types";

export default function OrganisationProfileScreen() {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganisationProfile()
      .then((records) => setOrg(records[0] ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "The profile could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const back = { label: "Organisation", href: "/organisation" };
  if (loading || error) return <ScreenState error={error} back={back} />;

  return (
    <Screen>
      <PageHeader title={org?.name ?? "Organisation profile"} back={back} />
      {!org ? (
        <EmptyState title="Not on this phone yet" body="Open this page once while online to keep a copy." />
      ) : (
        <Card>
          <InfoList
            rows={[
              ["Legal name", org.legalName ?? "Not recorded"],
              ["Registration number", org.registrationNumber ?? "Not recorded"],
              ["Status", org.status ?? "active"],
            ]}
          />
        </Card>
      )}
    </Screen>
  );
}
