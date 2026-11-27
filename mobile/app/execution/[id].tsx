import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { ActionBar, AppText, Banner, Button, Card, CheckRow, Chip, ChipRow, PageHeader, PermitStatusChip, RefChip, Screen, ScreenState, SectionTitle, TextField } from "@/components/ui";
import { Camera, CloudOff, Images, ListChecks, Pause, Play, Save } from "@/components/ui/icons";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getDayCycle } from "@/lib/multi-day/api";
import { dayCycleLabel, dayCycleTone } from "@/lib/multi-day/day-cycle";
import type { DayCycleSnapshot } from "@/lib/multi-day/types";
import {
  activatePermit,
  completeExecution,
  getWorkCycle,
  releasePermitForExecution,
  addProgress,
  pauseWork,
  resumePermit,
  resumeWork,
  suspendPermit,
  uploadEvidence,
} from "@/lib/execution/api";
import { initExecutionOfflineStorage, queueOfflineEvidence, queueOfflineProgress } from "@/lib/execution/offline";
import type { WorkCycleSnapshot } from "@/lib/execution/types";
import { getProfile } from "@/lib/auth/api";
import { formatDateTime } from "@/lib/format";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";
import { useTheme } from "@/providers/theme-provider";

export default function ExecutePermitScreen() {
  const { tokens } = useTheme();
  const [suspending, setSuspending] = useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [dayCycle, setDayCycle] = useState<DayCycleSnapshot | null>(null);
  const [summary, setSummary] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [privileged, setPrivileged] = useState(false);
  const [siteReady, setSiteReady] = useState(false);
  const [detailsCorrect, setDetailsCorrect] = useState(false);
  const [lototoRestored, setLototoRestored] = useState(false);
  const [workCycle, setWorkCycle] = useState<WorkCycleSnapshot | null>(null);
  const [pausing, setPausing] = useState(false);
  const [pauseSummary, setPauseSummary] = useState("");
  const [pauseChecks, setPauseChecks] = useState<Record<string, boolean>>({});
  const [lateReason, setLateReason] = useState("");
  const [resumeChecks, setResumeChecks] = useState<Record<string, boolean>>({});
  const [crewUserIds, setCrewUserIds] = useState("");
  const [completeComment, setCompleteComment] = useState("");
  const [completeChecks, setCompleteChecks] = useState({
    workDescribedComplete: false,
    procedureFollowed: false,
    lototoDone: false,
    gasTestingDone: false,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await initExecutionOfflineStorage();
      const [permitDetail, profile] = await Promise.all([
        getPermit(permitId),
        getProfile().catch(() => null),
      ]);
      setDetail(permitDetail);
      setLototoRestored(permitDetail.permit.lototoRestored === true);
      setUserId(profile?.id ?? null);
      setPrivileged(Boolean(profile?.roles.some((role) => role === "tenant-owner" || role === "tenant-admin" || role === "platform-admin")));
      if (permitDetail.multiDay?.isMultiDay) {
        setDayCycle(await getDayCycle(permitId).catch(() => null));
      } else {
        setDayCycle(null);
      }
      if (permitDetail.permit.status === "active" || permitDetail.permit.status === "suspended") {
        const work = await getWorkCycle(permitId).catch(() => null);
        setWorkCycle(work);
        if (work) {
          const nextPause: Record<string, boolean> = {};
          for (const item of work.pauseTemplate.items) nextPause[item.key] = false;
          setPauseChecks(nextPause);
          const nextResume: Record<string, boolean> = {};
          for (const item of work.resumeTemplate.items) nextResume[item.key] = false;
          setResumeChecks(nextResume);
        }
      } else {
        setWorkCycle(null);
      }
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

  async function handleRelease() {
    Alert.alert("Release for execution", "Release this permit for execution? The executor can then start the work.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Release for execution",
        onPress: () => void runAction(
          () => releasePermitForExecution(permitId, { siteReady: true, detailsCorrect: true }),
          "Released for execution",
        ),
      },
    ]);
  }

  async function handleStart() {
    if (!detail?.permit.executionReleasedAt) {
      await runAction(async () => {
        await releasePermitForExecution(permitId, { siteReady: true, detailsCorrect: true });
        await activatePermit(permitId);
      }, "Work started");
      return;
    }
    await handleActivate();
  }

  async function handleResume() {
    await runAction(() => resumePermit(permitId), "Resumed after suspension");
  }

  async function handlePauseWork() {
    if (!pauseSummary.trim()) {
      setError("Add a period summary before pausing.");
      return;
    }
    const items = workCycle?.pauseTemplate.items ?? [];
    if (items.some((item) => item.required && pauseChecks[item.key] !== true)) {
      setError("Complete the leave-safe checklist before pausing.");
      return;
    }
    const missed = workCycle?.missingPriorSecureDates ?? [];
    if (missed.length > 0 && lateReason.trim().length < 3) {
      setError("A late secure needs a reason of at least 3 characters.");
      return;
    }
    await runAction(
      () =>
        pauseWork(permitId, {
          summary: pauseSummary.trim(),
          checklist: pauseChecks,
          lateReason: missed.length > 0 ? lateReason.trim() : undefined,
        }),
      "Work paused",
    );
    setPausing(false);
    setPauseSummary("");
  }

  async function handleResumeWork() {
    const items = workCycle?.resumeTemplate.items ?? [];
    if (items.some((item) => item.required && resumeChecks[item.key] !== true)) {
      setError("Complete the resume checklist before continuing.");
      return;
    }
    if (workCycle?.handoverRequired === true && workCycle.handoverAccepted !== true) {
      setError("Accept the handover from the person who paused before resuming.");
      return;
    }
    if (workCycle?.crewRosterRequired === true) {
      const crewIds = crewUserIds.split(/[,\s]+/).map((value) => value.trim()).filter(Boolean);
      if (crewIds.length < 1) {
        setError("Add today's crew before resuming.");
        return;
      }
    }
    const suggestionById = new Map((workCycle?.suggestedCrew ?? []).map((row) => [row.workforceUserId, row.role]));
    const crewIds = crewUserIds.split(/[,\s]+/).map((value) => value.trim()).filter(Boolean);
    await runAction(
      () =>
        resumeWork(permitId, {
          checklist: resumeChecks,
          crew:
            workCycle?.crewRosterRequired === true
              ? crewIds.map((workforceUserId) => ({
                  workforceUserId,
                  role: suggestionById.get(workforceUserId) ?? "primary",
                }))
              : undefined,
        }),
      "Work resumed",
    );
  }

  async function handleCompleteWork() {
    const lototoOk = !detail?.permit.lototoRequired || completeChecks.lototoDone;
    const gasOk = !detail?.permit.gasTestingRequired || completeChecks.gasTestingDone;
    if (
      !completeComment.trim() ||
      !completeChecks.workDescribedComplete ||
      !completeChecks.procedureFollowed ||
      !lototoOk ||
      !gasOk
    ) {
      setError("Complete the checklist and comment before ending the job.");
      return;
    }
    Alert.alert("Ends the job", "This completes work for this permit. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark completed",
        style: "destructive",
        onPress: () =>
          void runAction(
            () =>
              completeExecution(permitId, {
                comment: completeComment.trim(),
                checklist: {
                  ...completeChecks,
                  lototoDone: !detail?.permit.lototoRequired || completeChecks.lototoDone,
                  gasTestingDone: !detail?.permit.gasTestingRequired || completeChecks.gasTestingDone,
                },
              }),
            "Work completed",
          ),
      },
    ]);
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
  const released = Boolean(permit.executionReleasedAt);
  const isReceiver = Boolean(userId && (permit.submittedBy === userId || permit.createdBy === userId));
  const canRelease = isReceiver || privileged;
  const assigned = Boolean(userId && detail.executors.some((row) => row.workforceUserId === userId));
  const canStart = assigned || privileged;
  const checksReady = siteReady && detailsCorrect;
  const releasesThenStarts = isApproved && !released && canRelease && canStart;
  const workPaused = workCycle?.workUiState === "paused";
  const workInProgress = workCycle?.workUiState === "in_progress" || (isActive && !workPaused && workCycle == null);
  const missedSecureDates = workCycle?.missingPriorSecureDates ?? [];
  const lateSecureBlocked = workInProgress && missedSecureDates.length > 0;
  const cutoffBlocked = workInProgress && workCycle?.pastCutoff === true && !lateSecureBlocked;
  const workWriteBlocked = lateSecureBlocked || cutoffBlocked || workCycle?.canRecordProgress === false;
  const handoverBlocked = workCycle?.handoverRequired === true && workCycle.handoverAccepted !== true;
  const crewRequired = workCycle?.crewRosterRequired === true;
  const suggestedCrew = workCycle?.suggestedCrew ?? [];

  return (
    <Screen
      footer={
        (isApproved && !released && canRelease) || (isApproved && released && canStart) || isSuspended ? (
          <ActionBar>
            {isApproved && !released && canRelease && !canStart ? (
              <Button label="Release for execution" size="lg" loading={submitting} disabled={!checksReady} onPress={handleRelease} />
            ) : null}
            {isApproved && ((released && canStart) || releasesThenStarts) ? (
              <Button label="Start work" icon={Play} size="lg" loading={submitting} disabled={releasesThenStarts && !checksReady} onPress={() => void handleStart()} />
            ) : null}
            {isSuspended ? (
              <Button label="Resume after suspension" icon={Play} size="lg" loading={submitting} onPress={() => void handleResume()} />
            ) : null}
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader title={permit.title} back={back}>
        <ChipRow>
          <PermitStatusChip status={permit.status} />
          {dayCycle?.isMultiDay ? (
            <Chip
              label={dayCycleLabel(dayCycle.dayCycleState)}
              color={
                dayCycleTone(dayCycle.dayCycleState) === "danger"
                  ? tokens.colors.danger
                  : dayCycleTone(dayCycle.dayCycleState) === "success"
                    ? tokens.colors.success
                    : tokens.colors.warning
              }
              dot
            />
          ) : null}
          <RefChip reference={permit.reference} />
        </ChipRow>
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="success">{message}</Banner> : null}
      {isSuspended ? <Banner tone="warning" title="Work is suspended">Resume only once the reason for stopping is dealt with.</Banner> : null}
      {isActive && workPaused ? (
        <Banner tone="warning" title="Work is paused">Resume before logging progress or completing.</Banner>
      ) : null}
      {isActive && workInProgress ? (
        <Banner tone="success" title="Work in progress">Log progress, pause leave-safe, or complete when finished.</Banner>
      ) : null}
      {isApproved && !released && canRelease ? (
        <Card style={{ gap: tokens.space[2] }}>
          <SectionTitle title="Release for execution" />
          <CheckRow label="Site is ready for execution" value={siteReady} onChange={setSiteReady} />
          <CheckRow label="The approved work, place and people are still correct" value={detailsCorrect} onChange={setDetailsCorrect} />
        </Card>
      ) : null}
      {isApproved && !released && !canRelease ? (
        <Banner tone="warning">Waiting for the receiver to release this permit.</Banner>
      ) : null}
      {isApproved && released ? (
        <Banner tone="success">Released for execution{permit.executionReleasedAt ? ` ${formatDateTime(permit.executionReleasedAt)}` : ""}.</Banner>
      ) : null}
      {permit.status === "execution_completed" && permit.lototoRequired && !lototoRestored ? (
        <Banner tone="warning">Work is complete. A personal lock is still on. Take it off before this permit can close.</Banner>
      ) : null}
      {permit.status === "execution_completed" && (!permit.lototoRequired || lototoRestored) ? (
        <Banner tone="success">Work is complete and sent for review and closure. The plant can stay isolated until it is restored in LOTOTO.</Banner>
      ) : null}

      {isActive && workPaused && workCycle ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title={workCycle.resumeTemplate.title} />
          <Card style={{ gap: tokens.space[2] }}>
            {workCycle.resumeTemplate.reisolateRequired ? (
              <AppText variant="caption">Full LOTOTO re-isolation is required before resume.</AppText>
            ) : null}
            {workCycle.resumeTemplate.simopsBlocked ? (
              <AppText variant="caption">{workCycle.resumeTemplate.simopsBlockReason || "Resolve blocking SIMOPS before resume."}</AppText>
            ) : null}
            {handoverBlocked ? (
              <AppText variant="caption">You did not pause this job. Resume stays blocked until the person who paused hands it to you and you accept that handover.</AppText>
            ) : null}
            {workCycle.resumeTemplate.items.map((item) => (
              <CheckRow
                key={item.key}
                label={item.label}
                value={resumeChecks[item.key] === true}
                onChange={(value) => setResumeChecks((current) => ({ ...current, [item.key]: value }))}
              />
            ))}
            {crewRequired ? (
              <>
                <TextField
                  label="Today's crew (workforce user IDs, comma-separated)"
                  required
                  multiline
                  value={crewUserIds}
                  onChangeText={setCrewUserIds}
                  placeholder="User ids"
                />
                {suggestedCrew.length > 0 ? (
                  <Button
                    label="Use permit executors"
                    variant="secondary"
                    onPress={() => setCrewUserIds(suggestedCrew.map((row) => row.workforceUserId).join(", "))}
                  />
                ) : null}
              </>
            ) : null}
            <Button
              label="Resume work"
              icon={Play}
              loading={submitting}
              disabled={handoverBlocked || workCycle.resumeTemplate.simopsBlocked === true}
              onPress={() => void handleResumeWork()}
            />
          </Card>
        </View>
      ) : null}

      {isActive && workInProgress ? (
        <>
          {lateSecureBlocked ? (
            <Banner tone="danger" title="Late secure">
              {`Progress, evidence, and complete are blocked until you pause. Missed days: ${missedSecureDates.join(", ")}.`}
            </Banner>
          ) : null}
          {cutoffBlocked ? (
            <Banner tone="danger" title="Cut-off passed">
              The operational day cut-off has passed. Pause and leave the area safe before logging more progress or completing.
            </Banner>
          ) : null}
          <View style={{ gap: tokens.space[3] }}>
            <SectionTitle title="Progress update" />
            <Card style={{ gap: tokens.space[3] }}>
              <TextField label="What was done" multiline value={summary} onChangeText={setSummary} placeholder="Describe the work since the last update" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
                <Button label="Save progress" icon={Save} disabled={submitting || workWriteBlocked || !summary.trim()} onPress={() => void handleProgress(false)} />
                <Button label="Save offline" variant="secondary" icon={CloudOff} disabled={submitting || workWriteBlocked || !summary.trim()} onPress={() => void handleProgress(true)} />
              </View>
            </Card>
          </View>

          <View style={{ gap: tokens.space[3] }}>
            <SectionTitle title="Evidence" />
            <Card>
              <AppText variant="caption">A photo of the work, the area or the isolation. It is attached to this permit.</AppText>
              <Button label="Take photo" variant="outline" icon={Camera} disabled={submitting || workWriteBlocked} onPress={() => void handleCameraCapture()} style={{ alignSelf: "flex-start" }} />
            </Card>
          </View>

          {pausing && workCycle ? (
            <Card style={{ gap: tokens.space[2] }}>
              <AppText variant="subheading">{workCycle.pauseTemplate.title}</AppText>
              <TextField label="Period summary" required multiline value={pauseSummary} onChangeText={setPauseSummary} placeholder="What was done; what remains" />
              {missedSecureDates.length > 0 ? (
                <TextField
                  label={`Late secure reason for ${missedSecureDates.join(", ")}`}
                  required
                  multiline
                  value={lateReason}
                  onChangeText={setLateReason}
                  placeholder="Why the earlier day was not secured"
                />
              ) : null}
              {workCycle.pauseTemplate.items.map((item) => (
                <CheckRow
                  key={item.key}
                  label={item.label}
                  value={pauseChecks[item.key] === true}
                  onChange={(value) => setPauseChecks((current) => ({ ...current, [item.key]: value }))}
                />
              ))}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
                <Button label="Pause work" icon={Pause} disabled={submitting || !pauseSummary.trim()} onPress={() => void handlePauseWork()} />
                <Button label="Cancel" variant="ghost" onPress={() => setPausing(false)} />
              </View>
            </Card>
          ) : (
            <Button label="Pause work" variant="secondary" icon={Pause} onPress={() => setPausing(true)} style={{ alignSelf: "flex-start" }} />
          )}

          <View style={{ gap: tokens.space[3] }}>
            <SectionTitle title="Complete work" />
            <Card style={{ gap: tokens.space[2] }}>
              <AppText variant="caption">Ends the job. Resume first if work is paused.</AppText>
              <CheckRow
                label="Work described in the permit is complete"
                value={completeChecks.workDescribedComplete}
                onChange={(value) => setCompleteChecks((c) => ({ ...c, workDescribedComplete: value }))}
              />
              <CheckRow
                label="Procedure was followed"
                value={completeChecks.procedureFollowed}
                onChange={(value) => setCompleteChecks((c) => ({ ...c, procedureFollowed: value }))}
              />
              {permit.lototoRequired ? (
                <CheckRow
                  label="LOTOTO is done"
                  value={completeChecks.lototoDone}
                  onChange={(value) => setCompleteChecks((c) => ({ ...c, lototoDone: value }))}
                />
              ) : null}
              {permit.gasTestingRequired ? (
                <CheckRow
                  label="Gas testing is done"
                  value={completeChecks.gasTestingDone}
                  onChange={(value) => setCompleteChecks((c) => ({ ...c, gasTestingDone: value }))}
                />
              ) : null}
              <TextField
                label="Completion comments"
                required
                multiline
                value={completeComment}
                onChangeText={setCompleteComment}
                placeholder="Required comments"
              />
              <Button
                label="Mark execution completed"
                loading={submitting}
                disabled={workWriteBlocked || !completeComment.trim()}
                onPress={() => void handleCompleteWork()}
              />
            </Card>
          </View>
        </>
      ) : null}

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Records" />
        <Card style={{ gap: 0 }}>
          <Button label="Progress timeline" variant="ghost" icon={ListChecks} onPress={() => router.push(`/execution/${permitId}/progress`)} style={{ alignSelf: "flex-start" }} />
          <Button label="Evidence gallery" variant="ghost" icon={Images} onPress={() => router.push(`/execution/${permitId}/evidence`)} style={{ alignSelf: "flex-start" }} />
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
