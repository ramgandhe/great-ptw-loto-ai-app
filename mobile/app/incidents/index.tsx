import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { AppText, Banner, Button, Card, Chip, ChipRow, EmptyState, PageHeader, RefChip, SafetyStatusChip, Screen } from "@/components/ui";
import { Siren } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { listIncidents } from "@/lib/incidents/api";
import type { Incident } from "@/lib/incidents/types";
import { INCIDENT_STATUS, INCIDENT_TYPE_LABELS, toneOf } from "@/lib/safety-status";
import { useTheme } from "@/providers/theme-provider";

export default function IncidentsScreen() {
  const { tokens } = useTheme();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listIncidents()
      .then(setIncidents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Incidents could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <PageHeader
        title="Incidents"
        description="Incidents, near misses and unsafe conditions, and how each is being handled."
        back={{ label: "Home", href: "/" }}
        actions={<Button label="Report incident" icon={Siren} onPress={() => router.push("/incidents/new")} />}
      />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : incidents.length === 0 ? (
        <EmptyState done title="No incidents reported" body="Reports you and your team make appear here." />
      ) : (
        incidents.map((incident) => (
          <Card key={incident.id} accent={tokens.status[toneOf(INCIDENT_STATUS, incident.status).key]} onPress={() => router.push(`/incidents/${incident.id}`)} accessibilityLabel={incident.title}>
            <AppText variant="subheading">{incident.title}</AppText>
            <ChipRow>
              <SafetyStatusChip map={INCIDENT_STATUS} status={incident.status} />
              <RefChip reference={incident.reference} />
              <Chip label={INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType} color={incident.incidentType === "incident" ? tokens.colors.danger : tokens.colors.warning} square />
            </ChipRow>
            <AppText variant="caption">{`Happened ${formatDateTime(incident.occurredAt)}`}</AppText>
          </Card>
        ))
      )}
    </Screen>
  );
}
