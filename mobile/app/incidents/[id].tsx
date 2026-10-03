import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ActionBar, AppText, Banner, Button, Card, Chip, ChipRow, InfoList, PageHeader, RefChip, SafetyStatusChip, Screen, ScreenState, TextField } from "@/components/ui";
import { Check, Lock, Plus, Send, UserCheck } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { INCIDENT_STATUS, INCIDENT_TYPE_LABELS } from "@/lib/safety-status";
import { ApiError } from "@/lib/api";
import {
  assignInvestigation,
  closeIncident,
  createCorrectiveAction,
  getIncident,
  recordRootCause,
  submitIncident,
  verifyIncident,
} from "@/lib/incidents/api";
import { queueOfflineIncidentSubmit } from "@/lib/incidents/offline";
import type { IncidentDetail } from "@/lib/incidents/types";
import { listTenantUserNames } from "@/lib/workforce/api";
import { SelectField } from "@/components/ui/select-field";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function IncidentDetailScreen() {
  const [message, setMessage] = useState<string | null>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const { isOnline } = useOffline();
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [investigatorId, setInvestigatorId] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveTitle, setCorrectiveTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  // People by name: the investigator and owners are sign-in accounts, so the work reaches their queue.
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    listTenantUserNames()
      .then((users) =>
        setPeople(
          users
            .map((u) => ({ value: u.id, label: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.username }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ),
      )
      .catch(() => setPeople([]));
  }, []);

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return getIncident(id).then(setDetail);
  }, [id]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof ApiError ? err.message : "The incident could not be loaded."))
      .finally(() => setLoading(false));
  }, [load]);

  async function runAction(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work. Try again.");
    }
  }

  const back = { label: "Incidents", href: "/incidents" };
  if (loading || !detail) {
    return <ScreenState error={loading ? null : (error ?? "This incident was not found.")} back={back} />;
  }

  const { incident } = detail;
  const open = incident.status !== "draft" && incident.status !== "closed";
  const step = { gap: tokens.space[3], padding: tokens.space[3], borderRadius: tokens.radii.md, backgroundColor: tokens.colors.muted };

  return (
    <Screen
      footer={
        incident.status === "draft" ? (
          <ActionBar>
            <Button
              label="Submit incident"
              icon={Send}
              onPress={async () => {
                if (!isOnline && id) {
                  await queueOfflineIncidentSubmit(id);
                  setMessage("Submission saved on this phone. It is not reported until the server confirms it.");
                  return;
                }
                await runAction(() => submitIncident(incident.id));
              }}
            />
          </ActionBar>
        ) : open ? (
          <ActionBar>
            <Button label="Close incident" variant="secondary" icon={Lock} onPress={() => void runAction(() => closeIncident(incident.id))} />
            <Button label="Verify" icon={Check} onPress={() => void runAction(() => verifyIncident(incident.id, { correctiveActionsConfirmed: true, preventiveActionsReviewed: true }))} />
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader title={incident.title} back={back}>
        <ChipRow>
          <SafetyStatusChip map={INCIDENT_STATUS} status={incident.status} />
          <RefChip reference={incident.reference} />
          <Chip label={INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType} color={incident.incidentType === "incident" ? tokens.colors.danger : tokens.colors.warning} square />
        </ChipRow>
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="warning">{message}</Banner> : null}

      <Card>
        <InfoList
          rows={[
            ["What happened", incident.description || "Not described"],
            ["When", formatDateTime(incident.occurredAt)],
            ["Evidence", detail.evidence.length ? `${detail.evidence.length} files` : "None"],
          ]}
        />
      </Card>

      {open ? (
        <Card style={{ gap: tokens.space[4] }}>
          <AppText variant="title">Investigation</AppText>
          <View style={step}>
            <AppText variant="label">1. Lead investigator</AppText>
            <SelectField label="Person" value={investigatorId} options={people} placeholder="Choose a person" onChange={setInvestigatorId} />
            <Button label="Assign" variant="outline" icon={UserCheck} disabled={!investigatorId} style={{ alignSelf: "flex-start" }} onPress={() => void runAction(() => assignInvestigation(incident.id, { investigatorId: investigatorId.trim() }))} />
          </View>
          <View style={step}>
            <AppText variant="label">2. Root cause</AppText>
            <TextField label="Why it happened" multiline value={rootCause} onChangeText={setRootCause} />
            <Button label="Record root cause" variant="outline" disabled={!rootCause.trim()} style={{ alignSelf: "flex-start" }} onPress={() => void runAction(() => recordRootCause(incident.id, { description: rootCause.trim() }))} />
          </View>
          <View style={step}>
            <AppText variant="label">3. Corrective action</AppText>
            <TextField label="Action" value={correctiveTitle} onChangeText={setCorrectiveTitle} placeholder="For example: replace the worn gasket" />
            <SelectField label="Owner" value={ownerId} options={people} placeholder="Choose a person" onChange={setOwnerId} />
            <AppText variant="caption">Due in seven days.</AppText>
            <Button
              label="Add corrective action"
              variant="outline"
              icon={Plus}
              disabled={!correctiveTitle.trim() || !ownerId}
              style={{ alignSelf: "flex-start" }}
              onPress={() => void runAction(() => createCorrectiveAction(incident.id, { title: correctiveTitle.trim(), ownerId: ownerId.trim(), dueDate: new Date(Date.now() + 7 * 86400000).toISOString() }))}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
