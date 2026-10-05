import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { PointStepper } from "@/components/lototo/point-stepper";
import { ActionBar, AppText, Banner, Button, Card, Chip, ChipRow, PageHeader, ProgressBar, SafetyStatusChip, Screen, ScreenState, SectionTitle, TextField } from "@/components/ui";
import { Camera, Check, Lock, Play, ShieldCheck, Tag, Unlock } from "@/components/ui/icons";
import { ISOLATION_STATUS } from "@/lib/safety-status";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  applyLock,
  applyTag,
  getIsolationExecutionForPlan,
  markIsolationComplete,
  markIsolationVerified,
  recordVerification,
  startIsolationExecution,
} from "@/lib/isolation-execution/api";
import {
  queueOfflineLock,
  queueOfflineTag,
  queueOfflineVerification,
} from "@/lib/isolation-execution/offline";
import type { IsolationExecutionDetail } from "@/lib/isolation-execution/types";
import { isolationProgress } from "@/lib/isolation-execution/progress";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function IsolationExecutionScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { tokens } = useTheme();
  const { isOnline } = useOffline();

  const [detail, setDetail] = useState<IsolationExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedPointId, setSelectedPointId] = useState("");
  const [lockTag, setLockTag] = useState("");
  const [lockMethod, setLockMethod] = useState("padlock");
  const [tagNumber, setTagNumber] = useState("");
  const [tagType, setTagType] = useState("danger");

  async function load() {
    if (!planId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getIsolationExecutionForPlan(planId);
      setDetail(data);
      // After each action, move on to the first point still to finish.
      setSelectedPointId(isolationProgress(data.sequence, data.locks, data.tags, data.verifications).current?.step.isolationPointId ?? "");
    } catch (err) {
      if (err instanceof ApiError && err.message.includes("not found")) {
        setDetail(null);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load execution");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [planId]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStart() {
    if (!planId) {
      return;
    }
    await runAction(async () => {
      await startIsolationExecution(planId);
    }, "Isolation started");
  }

  async function handleApplyLock(offline: boolean) {
    if (!detail || !selectedPointId || !lockTag.trim()) {
      setError("Point and lock tag required");
      return;
    }

    const payload = {
      isolationPointId: selectedPointId,
      lockTag: lockTag.trim(),
      lockMethod: lockMethod.trim(),
    };

    if (offline || !isOnline) {
      await queueOfflineLock(detail.execution.id, payload);
      setMessage("Lock saved on this phone. It is not applied until the server confirms it.");
      setLockTag("");
      return;
    }

    await runAction(async () => {
      await applyLock(detail.execution.id, payload);
      setLockTag("");
    }, "Lock applied");
  }

  async function handleApplyTag(offline: boolean) {
    if (!detail || !selectedPointId || !tagNumber.trim()) {
      setError("Point and tag number required");
      return;
    }

    const payload = {
      isolationPointId: selectedPointId,
      tagNumber: tagNumber.trim(),
      tagType: tagType.trim(),
    };

    if (offline || !isOnline) {
      await queueOfflineTag(detail.execution.id, payload);
      setMessage("Tag saved on this phone. It is not applied until the server confirms it.");
      setTagNumber("");
      return;
    }

    await runAction(async () => {
      await applyTag(detail.execution.id, payload);
      setTagNumber("");
    }, "Tag applied");
  }

  async function handleVerify() {
    if (!detail || !selectedPointId) {
      return;
    }

    Alert.alert(
      "Record verification",
      "Record a passing verification for this isolation point?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            const payload = {
              isolationPointId: selectedPointId,
              result: "pass" as const,
              method: "try-out",
            };

            if (!isOnline) {
              void queueOfflineVerification(detail.execution.id, payload).then(() => {
                setMessage("Verification saved on this phone. It is not recorded until the server confirms it.");
              });
              return;
            }

            void runAction(async () => {
              await recordVerification(detail.execution.id, payload);
            }, "Verification recorded");
          },
        },
      ],
    );
  }

  async function handleCameraCapture() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Allow camera access in the phone's settings to take evidence photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setMessage("Photo taken. Photos of isolation points are not uploaded from the phone yet; add them on the web.");
  }

  const back = { label: "Isolate", href: "/lototo/active" };
  if (loading) {
    return <ScreenState back={back} />;
  }

  if (!detail) {
    return (
      <Screen footer={<ActionBar><Button label="Start isolation" icon={Play} size="lg" loading={submitting} onPress={() => void handleStart()} /></ActionBar>}>
        <PageHeader title="Isolation" description="No isolation has started for this plan yet." back={back} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </Screen>
    );
  }

  const execution = detail.execution;
  const canApply = execution.status === "in_progress";
  const { points, current, left } = isolationProgress(detail.sequence, detail.locks, detail.tags, detail.verifications);
  const selected = points.find((p) => p.step.isolationPointId === selectedPointId) ?? current;
  const finished = points.filter((p) => p.done && p !== selected);
  const c = tokens.colors;
  const confirmThen = (title: string, body: string, run: () => void) =>
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: run },
    ]);
  const allLocked = points.length > 0 && points.every((p) => p.lock);
  const done = (label: string) => <Chip label={label} color={c.success} icon={Check} />;
  const stepBox = { gap: tokens.space[3], padding: tokens.space[3], borderRadius: tokens.radii.md, borderWidth: 1, borderColor: c.border };

  return (
    <Screen
      footer={
        execution.status === "in_progress" ? (
          <ActionBar>
            <Button
              label="Mark isolation complete"
              icon={Lock}
              loading={submitting}
              disabled={!allLocked}
              onPress={() => confirmThen("Mark isolation complete", "Every point is locked and isolation is complete?", () => void runAction(() => markIsolationComplete(execution.id).then(() => undefined), "Isolation complete"))}
            />
          </ActionBar>
        ) : execution.status === "isolated" ? (
          <ActionBar>
            <Button
              label="Complete verification"
              icon={ShieldCheck}
              loading={submitting}
              onPress={() => confirmThen("Complete verification", "All required verifications passed and work may start?", () => void runAction(() => markIsolationVerified(execution.id).then(() => undefined), "Isolation verified"))}
            />
          </ActionBar>
        ) : execution.status === "verified" ? (
          <ActionBar>
            {detail.plan?.permitId ? <Button label="Permit work" variant="outline" onPress={() => router.push(`/execution/${detail.plan!.permitId}`)} /> : null}
            <Button label="Start restoration" icon={Unlock} onPress={() => router.push(`/lototo/restoration/${execution.id}`)} />
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader title={detail.plan?.title ?? "Isolation"} back={back}>
        <ChipRow>
          <SafetyStatusChip map={ISOLATION_STATUS} status={execution.status} />
          {isOnline ? null : <Chip label="Offline" color={c.warning} dot />}
        </ChipRow>
        {points.length > 0 ? (
          <ProgressBar value={points.length - left} total={points.length} label={left === 0 ? `All ${points.length} points done` : `${left} of ${points.length} points to do`} color={c.success} />
        ) : (
          <AppText variant="caption">No isolation sequence is configured for this plan.</AppText>
        )}
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="success">{message}</Banner> : null}

      {/* Points in the approved order; a point opens once every earlier point is locked. */}
      {points.length > 0 ? (
        <PointStepper
          points={points.map((p) => ({ id: p.step.isolationPointId, order: p.step.sequenceOrder, label: p.step.isolationNumber, done: p.done, open: p.open }))}
          selectedId={selected?.step.isolationPointId}
          onSelect={setSelectedPointId}
        />
      ) : null}

      {selected ? (
        <Card accent={selected.done ? c.success : c.primary} style={{ gap: tokens.space[4] }}>
          <View style={{ gap: 2 }}>
            <AppText variant="title">{`Point ${selected.step.sequenceOrder}: ${selected.step.isolationNumber}`}</AppText>
            {selected.step.description ? <AppText variant="body" tone="secondary">{selected.step.description}</AppText> : null}
          </View>

          <View style={stepBox}>
            <AppText variant="label">1. Lock</AppText>
            {selected.lock ? (
              done(`Locked: ${selected.lock.lockTag} · ${selected.lock.lockMethod}`)
            ) : (
              <>
                <TextField label="Lock tag number" value={lockTag} onChangeText={setLockTag} autoCapitalize="characters" />
                <TextField label="Lock method" value={lockMethod} onChangeText={setLockMethod} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
                  <Button label="Apply lock" icon={Lock} disabled={!canApply || !selected.open || submitting} onPress={() => void handleApplyLock(false)} />
                  {!isOnline ? <Button label="Save on this phone" variant="secondary" disabled={!canApply || submitting} onPress={() => void handleApplyLock(true)} /> : null}
                </View>
              </>
            )}
          </View>

          <View style={stepBox}>
            <AppText variant="label">2. Tag</AppText>
            {selected.tag ? (
              done(`Tagged: ${selected.tag.tagNumber} · ${selected.tag.tagType}`)
            ) : (
              <>
                <TextField label="Tag number" value={tagNumber} onChangeText={setTagNumber} autoCapitalize="characters" />
                <Button label="Apply tag" icon={Tag} disabled={!canApply || submitting} onPress={() => void handleApplyTag(false)} style={{ alignSelf: "flex-start" }} />
              </>
            )}
          </View>

          {selected.step.requiresVerification ? (
            <View style={stepBox}>
              <AppText variant="label">3. Verify</AppText>
              {selected.verification ? (
                done("Verified: isolation holds")
              ) : (
                <>
                  <AppText variant="caption">{selected.lock ? "Try to start the equipment; record a pass when it stays isolated." : "Lock this point before verifying it."}</AppText>
                  <Button label="Record pass" icon={ShieldCheck} variant="outline" disabled={!selected.lock || submitting} onPress={() => void handleVerify()} style={{ alignSelf: "flex-start" }} />
                </>
              )}
            </View>
          ) : null}

          <Button label="Take evidence photo" variant="ghost" icon={Camera} onPress={() => void handleCameraCapture()} style={{ alignSelf: "flex-start" }} />
        </Card>
      ) : null}

      {finished.length > 0 ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Finished points" count={finished.length} color={c.success} />
          <Card>
            {finished.map((p) => (
              <View key={p.step.isolationPointId} style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3], minHeight: 40 }}>
                <Check size={16} color={c.success} />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="semibold">{`${p.step.sequenceOrder}. ${p.step.isolationNumber}`}</AppText>
                  <AppText variant="caption">{`Lock ${p.lock?.lockTag ?? "—"} · tag ${p.tag?.tagNumber ?? "—"}${p.step.requiresVerification ? " · verified" : ""}`}</AppText>
                </View>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
