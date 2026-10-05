import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ActionBar, AppText, Banner, Button, Card, CheckRow, ChipRow, PageHeader, PermitStatusChip, RefChip, Screen, ScreenState, SectionTitle, TextField } from "@/components/ui";
import { CloudOff, Lock, ShieldCheck } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { closePermit, getPermitVerification, verifyPermit } from "@/lib/closure/api";
import { initClosureOfflineStorage, queueOfflineVerification } from "@/lib/closure/offline";
import {
  defaultVerificationChecklist,
  type VerificationChecklist,
} from "@/lib/closure/types";
import { listEvidence, listProgress } from "@/lib/execution/api";
import { getPermit } from "@/lib/permit/api";
import { isOfflineError } from "@/lib/permit/offline";
import { stageAnswersLeft, stageAnswersPayload, type StageAnswerEdits } from "@/lib/permit/forms";
import { StageAnswers, useSignerName } from "@/components/permit/stage-answers";
import type { PermitDetail } from "@/lib/permit/types";
import { useTheme } from "@/providers/theme-provider";

const checklistLabels: Record<keyof VerificationChecklist, string> = {
  workCompleted: "Work completed as described",
  evidenceReviewed: "Evidence reviewed",
  areaSecured: "Work area secured",
  hazardsRemoved: "Temporary hazards removed",
};

function isChecklistComplete(checklist: VerificationChecklist): boolean {
  return Object.values(checklist).every(Boolean);
}

export default function PermitVerificationScreen() {
  const { tokens } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  // null: could not be loaded (shown as such, never as zero).
  const [progressCount, setProgressCount] = useState<number | null>(0);
  const [evidenceCount, setEvidenceCount] = useState<number | null>(0);
  const [checklist, setChecklist] = useState(defaultVerificationChecklist);
  const [comment, setComment] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [closeChecklist, setCloseChecklist] = useState(defaultVerificationChecklist);
  const [closeComment, setCloseComment] = useState("");
  const [stageEdits, setStageEdits] = useState<StageAnswerEdits>({});
  const signerName = useSignerName();

  useEffect(() => {
    if (!permitId) {
      return;
    }
    Promise.all([
      initClosureOfflineStorage(),
      getPermit(permitId),
      getPermitVerification(permitId).catch(() => null),
      listProgress(permitId).catch(() => null),
      listEvidence(permitId).catch(() => null),
    ])
      .then(([, permitDetail, verificationRecord, progress, evidence]) => {
        setDetail(permitDetail);
        setVerified(Boolean(verificationRecord));
        setProgressCount(progress ? progress.length : null);
        setEvidenceCount(evidence ? evidence.length : null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "The permit could not be loaded."))
      .finally(() => setLoading(false));
  }, [permitId]);

  function toggleChecklist(key: keyof VerificationChecklist, value: boolean) {
    setChecklist((current) => ({ ...current, [key]: value }));
  }

  async function handleVerify(offline: boolean) {
    if (!isChecklistComplete(checklist) || !comment.trim()) {
      setError("Tick every check and add a comment.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (offline) {
        await queueOfflineVerification(permitId, checklist, comment.trim() || undefined);
        setMessage("Inspection saved on this phone. It is not verified until it reaches the server.");
      } else {
        await verifyPermit(permitId, {
          checklist,
          comment: comment.trim(),
          stageAnswers: detail ? stageAnswersPayload(stageEdits, detail.permit.draftRevision) : undefined,
        });
        setVerified(true);
        setStageEdits({});
        setDetail(await getPermit(permitId));
        setMessage("Verification submitted");
      }
    } catch (err) {
      // Only a lost connection is queued; a refusal from the server is shown, never queued.
      if (!offline && isOfflineError(err)) {
        try {
          await queueOfflineVerification(permitId, checklist, comment.trim() || undefined);
          setMessage("No connection. Inspection saved on this phone; it is not verified until it reaches the server.");
        } catch {
          setError("The inspection could not be saved offline.");
        }
      } else {
        setError(err instanceof ApiError ? err.message : "Verification failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    if (!isChecklistComplete(closeChecklist) || !closeComment.trim()) {
      setError("Tick every check and add a closure comment.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await closePermit(permitId, {
        comment: closeComment.trim(),
        checklist: closeChecklist,
        stageAnswers: detail ? stageAnswersPayload(stageEdits, detail.permit.draftRevision) : undefined,
      });
      router.replace(`/closure/archive/${permitId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Closure failed");
    } finally {
      setSubmitting(false);
    }
  }

  const back = { label: "Closure", href: "/closure" };
  if (loading || !detail) {
    return <ScreenState error={loading ? null : (error ?? "This permit was not found.")} back={back} />;
  }

  const closureLeft = stageAnswersLeft(detail.permit.formResponses ?? [], "closure", stageEdits);
  const keys = Object.keys(checklistLabels) as Array<keyof VerificationChecklist>;
  const list = verified ? closeChecklist : checklist;
  const setItem = (key: keyof VerificationChecklist, value: boolean) =>
    verified ? setCloseChecklist((c) => ({ ...c, [key]: value })) : toggleChecklist(key, value);

  return (
    <Screen
      footer={
        <ActionBar>
          {verified ? (
            <Button
              label="Close permit"
              icon={Lock}
              loading={submitting}
              disabled={closureLeft > 0 || !isChecklistComplete(closeChecklist) || !closeComment.trim()}
              onPress={() => void handleClose()}
            />
          ) : (
            <>
              <Button label="Save offline" variant="secondary" icon={CloudOff} disabled={submitting || !isChecklistComplete(checklist)} onPress={() => void handleVerify(true)} />
              <Button label="Submit verification" icon={ShieldCheck} loading={submitting} disabled={!isChecklistComplete(checklist) || !comment.trim()} onPress={() => void handleVerify(false)} />
            </>
          )}
        </ActionBar>
      }
    >
      <PageHeader
        title={detail.permit.title}
        description={`${progressCount ?? "Could not load"} progress update${progressCount === 1 ? "" : "s"} · ${evidenceCount ?? "could not load"} evidence file${evidenceCount === 1 ? "" : "s"}`}
        back={back}
      >
        <ChipRow>
          <PermitStatusChip status={detail.permit.status} />
          <RefChip reference={detail.permit.reference} />
        </ChipRow>
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="success">{message}</Banner> : null}
      {verified ? <Banner tone="info" title="Verified">The head of department signs off and closes the permit.</Banner> : null}

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title={verified ? "Final sign-off" : "Final inspection"} description={verified ? "Confirm each check before closing." : "Confirm on site, then submit."} />
        <Card style={{ gap: tokens.space[1] }}>
          {keys.map((key) => (
            <CheckRow key={key} label={checklistLabels[key]} value={list[key]} onChange={(value) => setItem(key, value)} disabled={submitting} />
          ))}
        </Card>
      </View>

      <Card style={{ gap: tokens.space[4] }}>
        <StageAnswers
          responses={detail.permit.formResponses ?? []}
          stage="closure"
          edits={stageEdits}
          onChange={setStageEdits}
          signerName={signerName}
          disabled={submitting}
        />
        {verified && closureLeft > 0 ? <AppText variant="caption" tone="warning" weight="semibold">{`${closureLeft} left to sign before closing.`}</AppText> : null}
        {verified ? (
          <TextField label="Closure comment" required multiline value={closeComment} onChangeText={setCloseComment} placeholder="What was checked before closing" />
        ) : (
          <TextField label="Verification comment" required multiline value={comment} onChangeText={setComment} placeholder="What you saw on site" />
        )}
      </Card>
    </Screen>
  );
}
