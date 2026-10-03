import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ActionBar, AppText, Banner, Button, Card, ChipRow, PageHeader, PermitStatusChip, RefChip, Screen, ScreenState, SectionTitle, TextField } from "@/components/ui";
import { Camera, CalendarDays, CloudOff, Images, ListChecks, Pause, Play, Save } from "@/components/ui/icons";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  activatePermit,
  addProgress,
  resumePermit,
  suspendPermit,
  uploadEvidence,
} from "@/lib/execution/api";
import { initExecutionOfflineStorage, queueOfflineEvidence, queueOfflineProgress } from "@/lib/execution/offline";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";
import { useTheme } from "@/providers/theme-provider";

export default function ExecutePermitScreen() {
  const { tokens } = useTheme();
  const [suspending, setSuspending] = useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await initExecutionOfflineStorage();
      setDetail(await getPermit(permitId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The permit could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (permitId) {
      load();
    }
  }, [permitId]);

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate() {
    await runAction(() => activatePermit(permitId), "Work started");
  }

  async function handleResume() {
    await runAction(() => resumePermit(permitId), "Work resumed");
  }

  async function handleSuspend() {
    if (!suspendReason.trim()) {
      setError("Say why the work is suspended.");
      return;
    }
    await runAction(() => suspendPermit(permitId, suspendReason.trim()), "Work suspended");
    setSuspendReason("");
    setSuspending(false);
  }

  async function handleProgress(offline: boolean) {
    if (!summary.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (offline) {
        await queueOfflineProgress(permitId, summary.trim());
        setMessage("Progress saved on this phone. It is not recorded until the server confirms it; send it from Work in progress.");
      } else {
        await addProgress(permitId, { summary: summary.trim() });
        setMessage("Progress recorded");
      }
      setSummary("");
    } catch (err) {
      if (!offline && err instanceof ApiError) {
        try {
          await queueOfflineProgress(permitId, summary.trim());
          setMessage("No connection. Progress saved on this phone; it is not recorded until the server confirms it.");
          setSummary("");
        } catch {
          setError(err.message);
        }
      } else {
        setError(err instanceof ApiError ? err.message : "The progress could not be recorded.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCameraCapture() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Allow camera access in the phone's settings to take evidence photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const file = {
      uri: asset.uri,
      name: asset.fileName ?? `evidence-${Date.now()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    };

    setSubmitting(true);
    setError(null);
    try {
      await uploadEvidence(permitId, file);
      setMessage("Evidence uploaded");
    } catch {
      await queueOfflineEvidence(permitId, {
        uri: file.uri,
        fileName: file.name,
        contentType: file.type,
      });
      setMessage("Upload failed. Evidence saved on this phone; it is not attached until the server confirms it.");
    } finally {
      setSubmitting(false);
    }
  }

  const back = { label: "Work in progress", href: "/execution" };
  if (loading || !detail) {
    return <ScreenState error={loading ? null : (error ?? "This permit was not found.")} back={back} />;
  }

  const { permit } = detail;
  const isApproved = permit.status === "approved";
  const isActive = permit.status === "active";
  const isSuspended = permit.status === "suspended";

  return (
    <Screen
      footer={
        isApproved || isSuspended ? (
          <ActionBar>
            <Button label={isApproved ? "Start work" : "Resume work"} icon={Play} size="lg" loading={submitting} onPress={() => void (isApproved ? handleActivate() : handleResume())} />
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader title={permit.title} back={back}>
        <ChipRow>
          <PermitStatusChip status={permit.status} />
          <RefChip reference={permit.reference} />
        </ChipRow>
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="success">{message}</Banner> : null}
      {isSuspended ? <Banner tone="warning" title="Work is suspended">Resume only once the reason for stopping is dealt with.</Banner> : null}

      {isActive ? (
        <>
          <View style={{ gap: tokens.space[3] }}>
            <SectionTitle title="Progress update" />
            <Card style={{ gap: tokens.space[3] }}>
              <TextField label="What was done" multiline value={summary} onChangeText={setSummary} placeholder="Describe the work since the last update" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
                <Button label="Save progress" icon={Save} disabled={submitting || !summary.trim()} onPress={() => void handleProgress(false)} />
                <Button label="Save offline" variant="secondary" icon={CloudOff} disabled={submitting || !summary.trim()} onPress={() => void handleProgress(true)} />
              </View>
            </Card>
          </View>

          <View style={{ gap: tokens.space[3] }}>
            <SectionTitle title="Evidence" />
            <Card>
              <AppText variant="caption">A photo of the work, the area or the isolation. It is attached to this permit.</AppText>
              <Button label="Take photo" variant="outline" icon={Camera} disabled={submitting} onPress={() => void handleCameraCapture()} style={{ alignSelf: "flex-start" }} />
            </Card>
          </View>
        </>
      ) : null}

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Records" />
        <Card style={{ gap: 0 }}>
          <Button label="Progress timeline" variant="ghost" icon={ListChecks} onPress={() => router.push(`/execution/${permitId}/progress`)} style={{ alignSelf: "flex-start" }} />
          <Button label="Evidence gallery" variant="ghost" icon={Images} onPress={() => router.push(`/execution/${permitId}/evidence`)} style={{ alignSelf: "flex-start" }} />
          {isActive || isSuspended ? (
            <Button label="Multi-day operations" variant="ghost" icon={CalendarDays} onPress={() => router.push(`/multi-day/${permitId}`)} style={{ alignSelf: "flex-start" }} />
          ) : null}
        </Card>
      </View>

      {isActive ? (
        suspending ? (
          <Card accent={tokens.colors.danger} style={{ gap: tokens.space[3] }}>
            <AppText variant="subheading">Suspend work</AppText>
            <TextField label="Why the work stops" required multiline value={suspendReason} onChangeText={setSuspendReason} placeholder="For example: gas reading above limit" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
              <Button label="Suspend work" variant="danger" icon={Pause} disabled={submitting || !suspendReason.trim()} onPress={() => void handleSuspend()} />
              <Button label="Cancel" variant="ghost" onPress={() => setSuspending(false)} />
            </View>
          </Card>
        ) : (
          <Button label="Suspend work" variant="danger" icon={Pause} onPress={() => setSuspending(true)} style={{ alignSelf: "flex-start" }} />
        )
      ) : null}
    </Screen>
  );
}
