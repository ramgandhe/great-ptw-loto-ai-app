import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { PointStepper } from "@/components/lototo/point-stepper";
import { ActionBar, AppText, Banner, Button, Chip, ChipRow, PageHeader, ProgressBar, SafetyStatusChip, Screen, ScreenState, TextField, Card } from "@/components/ui";
import { Check, History, Lock, Tag, Unlock } from "@/components/ui/icons";
import { ISOLATION_STATUS } from "@/lib/safety-status";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getIsolationExecutionDetail } from "@/lib/isolation-execution/api";
import type { IsolationExecutionDetail } from "@/lib/isolation-execution/types";
import {
  completeRestoration,
  getExecutionHistory,
  getRestoration,
  removeLock,
  removeTag,
  restoreEquipment,
} from "@/lib/restoration/api";
import type { RestorationDetail } from "@/lib/restoration/types";
import { restorationProgress } from "@/lib/restoration/progress";
import {
  queueOfflineEquipmentRestore,
  queueOfflineLockRemoval,
  queueOfflineTagRemoval,
} from "@/lib/restoration/offline";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function RestorationScreen() {
  const { executionId } = useLocalSearchParams<{ executionId: string }>();
  const { tokens } = useTheme();
  const { isOnline } = useOffline();

  const [executionDetail, setExecutionDetail] = useState<IsolationExecutionDetail | null>(null);
  const [restoration, setRestoration] = useState<RestorationDetail | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedPointId, setSelectedPointId] = useState("");
  const [restoreMethod, setRestoreMethod] = useState("re-energise");

  async function load() {
    if (!executionId) {
      return;
    }
    const [iso, rest, hist] = await Promise.all([
      getIsolationExecutionDetail(executionId),
      getRestoration(executionId),
      getExecutionHistory(executionId),
    ]);
    setExecutionDetail(iso);
    setRestoration(rest);
    setHistoryCount(hist.length);
    // Work on the first point with something still on it.
    setSelectedPointId(restorationProgress(iso.sequence, iso.locks, iso.tags, rest).current?.step.isolationPointId ?? "");
  }

  useEffect(() => {
    load()
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load restoration");
      })
      .finally(() => setLoading(false));
  }, [executionId]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await load();
      setMessage((current) => current ?? successMessage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  const back = { label: "Restore", href: "/lototo/restoration" };
  if (loading || !executionDetail || !restoration) {
    return <ScreenState error={loading ? null : (error ?? "This restoration was not found.")} back={back} />;
  }

  const canRestore = restoration.execution.status === "verified";
  const { points, current, outstanding } = restorationProgress(executionDetail.sequence, executionDetail.locks, executionDetail.tags, restoration);
  const selected = points.find((p) => p.step.isolationPointId === selectedPointId) ?? current;
  const c = tokens.colors;
  // Each removal and restoration is its own confirmed step. Offline, it is saved on the phone and
  // reported as not done until the server confirms it.
  const confirmed = (title: string, body: string, online: () => Promise<unknown>, offline: () => Promise<unknown>, done: string) =>
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () =>
          void runAction(async () => {
            if (isOnline) await online();
            else {
              await offline();
              setMessage(`${done}: saved on this phone, not done until the server confirms it.`);
            }
          }, done),
      },
    ]);

  const stepBox = { gap: tokens.space[3], padding: tokens.space[3], borderRadius: tokens.radii.md, borderWidth: 1, borderColor: c.border };

  return (
    <Screen
      footer={
        canRestore ? (
          <ActionBar>
            <Button
              label={outstanding.points > 0 ? `${outstanding.points} to restore first` : "Complete restoration"}
              icon={Unlock}
              loading={submitting}
              disabled={outstanding.points > 0}
              onPress={() =>
                Alert.alert("Complete restoration", "Every point is restored?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Confirm", onPress: () => void runAction(async () => void (await completeRestoration(executionId!)), "Restoration complete") },
                ])
              }
            />
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader title={executionDetail.plan?.title ?? "Restoration"} back={back}>
        <ChipRow>
          <SafetyStatusChip map={ISOLATION_STATUS} status={restoration.execution.status} />
          {isOnline ? null : <Chip label="Offline" color={c.warning} dot />}
        </ChipRow>
        <ProgressBar
          value={points.length - outstanding.points}
          total={points.length}
          color={c.success}
          label={`${outstanding.points} of ${points.length} points to restore · ${outstanding.locks} lock${outstanding.locks === 1 ? "" : "s"} and ${outstanding.tags} tag${outstanding.tags === 1 ? "" : "s"} still on`}
        />
      </PageHeader>

      {!canRestore && restoration.execution.status !== "restored" ? <Banner tone="warning">Restoration starts once the isolation is verified.</Banner> : null}
      {restoration.execution.status === "restored" ? (
        <Banner tone="success" title="Restored">{`${restoration.restorations.length} points restored · ${historyCount} history events`}</Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="success">{message}</Banner> : null}

      <PointStepper
        points={points.map((p) => ({ id: p.step.isolationPointId, order: p.step.sequenceOrder, label: p.step.isolationNumber, done: p.done, open: true }))}
        selectedId={selected?.step.isolationPointId}
        onSelect={setSelectedPointId}
      />

      {selected ? (
        <Card accent={selected.done ? c.success : c.primary} style={{ gap: tokens.space[4] }}>
          <AppText variant="title">{`Point ${selected.step.sequenceOrder}: ${selected.step.isolationNumber}`}</AppText>

          <View style={stepBox}>
            <AppText variant="label">1. Remove locks and tags</AppText>
            {selected.locks.length + selected.tags.length === 0 ? <Chip label="Nothing left on this point" color={c.success} icon={Check} /> : null}
            {selected.locks.map((lock) => (
              <Button
                key={lock.id}
                label={`Remove lock ${lock.lockTag}`}
                variant="outline"
                icon={Lock}
                disabled={!canRestore || submitting}
                style={{ alignSelf: "flex-start" }}
                onPress={() => confirmed("Remove lock", `Remove lock ${lock.lockTag}?`, () => removeLock(executionId!, lock.id), () => queueOfflineLockRemoval(executionId!, { appliedLockId: lock.id }), "Lock removed")}
              />
            ))}
            {selected.tags.map((tag) => (
              <Button
                key={tag.id}
                label={`Remove tag ${tag.tagNumber}`}
                variant="outline"
                icon={Tag}
                disabled={!canRestore || submitting}
                style={{ alignSelf: "flex-start" }}
                onPress={() => confirmed("Remove tag", `Remove tag ${tag.tagNumber}?`, () => removeTag(executionId!, tag.id), () => queueOfflineTagRemoval(executionId!, { appliedTagId: tag.id }), "Tag removed")}
              />
            ))}
          </View>

          <View style={stepBox}>
            <AppText variant="label">2. Restore</AppText>
            {selected.restored ? (
              <Chip label={`Restored${selected.restored.method ? ` · ${selected.restored.method}` : ""}`} color={c.success} icon={Check} />
            ) : (
              <>
                <TextField label="How it was restored" value={restoreMethod} onChangeText={setRestoreMethod} placeholder="Optional" />
                <Button
                  label="Restore point"
                  icon={Unlock}
                  disabled={!canRestore || submitting}
                  style={{ alignSelf: "flex-start" }}
                  onPress={() => {
                    const payload = { isolationPointId: selected.step.isolationPointId, method: restoreMethod.trim() || undefined };
                    confirmed(
                      "Restore point",
                      `Restore ${selected.step.isolationNumber}?${selected.locks.length + selected.tags.length ? " Locks or tags are still on this point." : ""}`,
                      () => restoreEquipment(executionId!, payload),
                      () => queueOfflineEquipmentRestore(executionId!, payload),
                      "Equipment restored",
                    );
                  }}
                />
              </>
            )}
          </View>
        </Card>
      ) : null}

      {executionDetail.plan ? (
        <Button label="LOTOTO history" variant="ghost" icon={History} onPress={() => router.push(`/lototo/history/${executionDetail.plan!.id}`)} style={{ alignSelf: "flex-start" }} />
      ) : null}
    </Screen>
  );
}
