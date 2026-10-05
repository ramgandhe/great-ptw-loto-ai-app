import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, Banner, Button, Card, ChipRow, ChoiceGroup, DateTimeField, PageHeader, PermitStatusChip, RefChip, Screen, ScreenState, Tabs, TextField } from "@/components/ui";
import { SelectField } from "@/components/ui/select-field";
import { CalendarPlus, Pause, Play, Send, UserCheck } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import {
  continuePermit,
  createHandover,
  listDailyActivityHistory,
  listDailyProgress,
  listHandovers,
  listRevalidationHistory,
  recordDailyProgress,
  requestExtension,
  revalidatePermit,
  suspendPermitForRevalidation,
} from "@/lib/multi-day/api";
import {
  queueOfflineDailyProgress,
  queueOfflineExtensionRequest,
  queueOfflineHandover,
  queueOfflineRevalidation,
} from "@/lib/multi-day/offline";
import type { RevalidationOutcome } from "@/lib/multi-day/types";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

function todayIsoDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type Job = "progress" | "handover" | "revalidate" | "extend";

export default function MultiDayPermitScreen() {
  const { permitId } = useLocalSearchParams<{ permitId: string }>();
  const { tokens } = useTheme();
  const { isOnline } = useOffline();

  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [directory, setDirectory] = useState<WorkforceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [operationalDate, setOperationalDate] = useState(todayIsoDate());
  const [completedWork, setCompletedWork] = useState("");
  const [pendingWork, setPendingWork] = useState("");
  const [summary, setSummary] = useState("");

  const [incomingUserId, setIncomingUserId] = useState("");
  const [completedActivities, setCompletedActivities] = useState("");
  const [outstandingWork, setOutstandingWork] = useState("");
  const [safetyObservations, setSafetyObservations] = useState("");

  const [revalidationOutcome, setRevalidationOutcome] = useState<RevalidationOutcome>("passed");
  const [findings, setFindings] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [requestedEndAt, setRequestedEndAt] = useState("");
  const [justification, setJustification] = useState("");
  const [job, setJob] = useState<Job>("progress");
  const [suspending, setSuspending] = useState(false);

  const load = useCallback(async () => {
    if (!permitId) return;
    const permitDetail = await getPermit(permitId);
    setDetail(permitDetail);
    if (["active", "suspended"].includes(permitDetail.permit.status)) {
      await Promise.all([
        listDailyProgress(permitId),
        listHandovers(permitId),
        listDailyActivityHistory(permitId),
        listRevalidationHistory(permitId),
      ]);
    }
  }, [permitId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([load(), listWorkforceDirectory().then(setDirectory).catch(() => setDirectory([]))])
      .catch((err) => setError(err instanceof ApiError ? err.message : "The permit could not be loaded."))
      .finally(() => setLoading(false));
  }, [load]);

  async function runAction(action: () => Promise<void>, success: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work. Try again.");
    }
  }

  const back = { label: "Permit work", href: `/execution/${permitId}` };
  if (loading || !detail || !permitId) {
    return <ScreenState error={loading ? null : (error ?? "This permit was not found.")} back={back} />;
  }

  const canManage = ["active", "suspended"].includes(detail.permit.status);
  const c = tokens.colors;
  const send = (label: string, icon: typeof Send, onPress: () => void, disabled = false) => (
    <Button label={label} icon={icon} disabled={disabled} onPress={onPress} style={{ alignSelf: "flex-start" }} />
  );

  return (
    <Screen>
      <PageHeader title="Multi-day work" description={detail.permit.title} back={back}>
        <ChipRow>
          <PermitStatusChip status={detail.permit.status} />
          <RefChip reference={detail.permit.reference} />
        </ChipRow>
        {canManage ? (
          <Tabs
            options={[
              { key: "progress", label: "Daily progress" },
              { key: "handover", label: "Handover" },
              { key: "revalidate", label: "Revalidate" },
              { key: "extend", label: "Extend" },
            ]}
            value={job}
            onChange={setJob}
          />
        ) : null}
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone={message.includes("this phone") ? "warning" : "success"}>{message}</Banner> : null}

      {!canManage ? (
        <Banner tone="info">Daily records, handovers and revalidation are for permits with work in progress or suspended.</Banner>
      ) : job === "progress" ? (
        <Card style={{ gap: tokens.space[3] }}>
          <AppText variant="title">Daily progress</AppText>
          <DateTimeField label="Day" dateOnly required value={operationalDate} onChange={setOperationalDate} />
          <TextField label="Work completed" required multiline value={completedWork} onChangeText={setCompletedWork} />
          <TextField label="Work still to do" multiline value={pendingWork} onChangeText={setPendingWork} />
          <TextField label="Summary of the day" required multiline value={summary} onChangeText={setSummary} />
          {send("Submit progress", Send, async () => {
            const payload = { operationalDate, completedWork: completedWork.trim(), pendingWork: pendingWork.trim() || undefined, summary: summary.trim(), submit: true };
            if (!isOnline) {
              await queueOfflineDailyProgress(permitId, payload);
              setMessage("Daily progress saved on this phone; not recorded until the server confirms it.");
              return;
            }
            await runAction(() => recordDailyProgress(permitId, payload).then(() => undefined), "Daily progress saved");
          }, !completedWork.trim() || !summary.trim())}
        </Card>
      ) : job === "handover" ? (
        <Card style={{ gap: tokens.space[3] }}>
          <AppText variant="title">Shift handover</AppText>
          <SelectField
            label="Handing over to"
            required
            value={incomingUserId}
            options={directory.map((person) => ({ value: person.id, label: person.name }))}
            placeholder="Choose the incoming person"
            onChange={setIncomingUserId}
          />
          <TextField label="Completed activities" required multiline value={completedActivities} onChangeText={setCompletedActivities} />
          <TextField label="Outstanding work" required multiline value={outstandingWork} onChangeText={setOutstandingWork} />
          <TextField label="Safety observations" multiline value={safetyObservations} onChangeText={setSafetyObservations} />
          {send("Complete handover", UserCheck, async () => {
            const payload = { incomingUserId, completedActivities: completedActivities.trim(), outstandingWork: outstandingWork.trim(), safetyObservations: safetyObservations.trim() || undefined };
            if (!isOnline) {
              await queueOfflineHandover(permitId, payload);
              setMessage("Handover saved on this phone; not recorded until the server confirms it.");
              return;
            }
            await runAction(() => createHandover(permitId, payload).then(() => undefined), "Handover saved");
          }, !incomingUserId)}
        </Card>
      ) : job === "revalidate" ? (
        <>
          <Card style={{ gap: tokens.space[3] }}>
            <AppText variant="title">Revalidation</AppText>
            <DateTimeField label="Day" dateOnly required value={operationalDate} onChange={setOperationalDate} />
            <ChoiceGroup
              label="Outcome"
              fill
              options={[
                { key: "passed" as const, label: "Passed", color: c.success },
                { key: "failed" as const, label: "Failed", color: c.danger },
              ]}
              value={revalidationOutcome}
              onChange={setRevalidationOutcome}
            />
            <TextField label="Findings" required multiline value={findings} onChangeText={setFindings} />
            {send("Submit revalidation", Send, async () => {
              const payload = { operationalDate, outcome: revalidationOutcome, findings: findings.trim() };
              if (!isOnline) {
                await queueOfflineRevalidation(permitId, payload);
                setMessage("Revalidation saved on this phone; not recorded until the server confirms it.");
                return;
              }
              await runAction(() => revalidatePermit(permitId, payload).then(() => undefined), "Revalidation saved");
            }, !findings.trim())}
          </Card>
          <Card style={{ gap: tokens.space[3] }}>
            <AppText variant="subheading">After revalidation</AppText>
            <Button label="Continue permit" variant="outline" icon={Play} onPress={() => void runAction(() => continuePermit(permitId).then(() => undefined), "Permit continued")} style={{ alignSelf: "flex-start" }} />
            {suspending ? (
              <>
                <TextField label="Why the permit is suspended" required multiline value={suspendReason} onChangeText={setSuspendReason} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
                  <Button
                    label="Suspend permit"
                    variant="danger"
                    icon={Pause}
                    disabled={!suspendReason.trim()}
                    onPress={() => void runAction(() => suspendPermitForRevalidation(permitId, suspendReason.trim()).then(() => undefined), "Permit suspended").then(() => setSuspending(false))}
                  />
                  <Button label="Cancel" variant="ghost" onPress={() => setSuspending(false)} />
                </View>
              </>
            ) : (
              <Button label="Suspend permit…" variant="danger" icon={Pause} onPress={() => setSuspending(true)} style={{ alignSelf: "flex-start" }} />
            )}
          </Card>
        </>
      ) : (
        <Card style={{ gap: tokens.space[3] }}>
          <AppText variant="title">Request an extension</AppText>
          <DateTimeField label="New end" required value={requestedEndAt} onChange={setRequestedEndAt} />
          <TextField label="Why more time is needed" required multiline value={justification} onChangeText={setJustification} />
          {send("Request extension", CalendarPlus, async () => {
            const payload = { requestedEndAt: new Date(requestedEndAt).toISOString(), justification: justification.trim() };
            if (!isOnline) {
              await queueOfflineExtensionRequest(permitId, payload);
              setMessage("Extension request saved on this phone; not sent until the server confirms it.");
              return;
            }
            await runAction(() => requestExtension(permitId, payload).then(() => undefined), "Extension requested");
          }, !requestedEndAt || !justification.trim())}
        </Card>
      )}
    </Screen>
  );
}
