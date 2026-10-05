import { useState } from "react";
import { router } from "expo-router";
import { ActionBar, Banner, Button, Card, ChoiceGroup, PageHeader, Screen, TextField } from "@/components/ui";
import { Save, Send } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { createIncident } from "@/lib/incidents/api";
import { queueOfflineIncidentReport } from "@/lib/incidents/offline";
import type { IncidentType } from "@/lib/incidents/types";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";
import { INCIDENT_TYPE_LABELS } from "@/lib/safety-status";

export default function NewIncidentScreen() {
  const { tokens } = useTheme();
  const { isOnline } = useOffline();
  const [incidentType, setIncidentType] = useState<IncidentType>("incident");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(submit: boolean) {
    setError(null);
    setTried(true);
    if (!title.trim() || (submit && !description.trim())) return;
    const payload = { incidentType, title: title.trim(), description: description.trim(), occurredAt: new Date().toISOString(), submit };
    setBusy(true);
    try {
      if (!isOnline) {
        await queueOfflineIncidentReport(payload);
        setMessage("Report saved on this phone. It is not reported until the server confirms it.");
        return;
      }
      const incident = await createIncident(payload);
      router.replace(`/incidents/${incident.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The report could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const c = tokens.colors;
  return (
    <Screen
      footer={
        <ActionBar>
          <Button label="Save draft" variant="secondary" icon={Save} disabled={busy} onPress={() => void handleSubmit(false)} />
          <Button label="Submit report" icon={Send} loading={busy} onPress={() => void handleSubmit(true)} />
        </ActionBar>
      }
    >
      <PageHeader title="Report incident" description="Say what happened now; details and evidence can be added after." back={{ label: "Incidents", href: "/incidents" }} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="warning" title="Saved on this phone">{message}</Banner> : null}
      <Card style={{ gap: tokens.space[4] }}>
        <ChoiceGroup
          label="What kind"
          options={(["incident", "near_miss", "unsafe_condition"] as IncidentType[]).map((key) => ({ key, label: INCIDENT_TYPE_LABELS[key], color: key === "incident" ? c.danger : c.warning }))}
          value={incidentType}
          onChange={setIncidentType}
        />
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="For example: Oil leak near pump P-101" error={tried && !title.trim() ? "Give the report a title." : null} />
        <TextField label="What happened" required multiline value={description} onChangeText={setDescription} placeholder="Where, who was involved, what was done straight away" error={tried && !description.trim() ? "Describe what happened before submitting." : null} />
      </Card>
    </Screen>
  );
}
