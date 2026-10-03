import { useEffect, useState } from "react";
import { Card, EmptyState, InfoList, PageHeader, Screen, ScreenState } from "@/components/ui";
import { loadMyProfile } from "@/lib/workforce/offline";
import type { WorkforceRecord } from "@/lib/workforce/types";

export default function WorkforceProfileScreen() {
  const [profile, setProfile] = useState<WorkforceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyProfile()
      .then((records) => setProfile(records[0] ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Your profile could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const back = { label: "Workforce", href: "/workforce" };
  if (loading || error) return <ScreenState error={error} back={back} />;

  return (
    <Screen>
      <PageHeader title={profile?.name ?? "My profile"} back={back} />
      {!profile ? (
        <EmptyState title="Not on this phone yet" body="Open this page once while online to keep a copy." />
      ) : (
        <Card>
          <InfoList
            rows={[
              ["Email", profile.email ?? "Not recorded"],
              ["Phone", profile.phone],
              ["Role", profile.role ?? "Not recorded"],
              ["Status", profile.status ?? "active"],
            ]}
          />
        </Card>
      )}
    </Screen>
  );
}
