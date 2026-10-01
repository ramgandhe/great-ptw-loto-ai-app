import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [progressCount, setProgressCount] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
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
      listProgress(permitId).catch(() => []),
      listEvidence(permitId).catch(() => []),
    ])
      .then(([, permitDetail, verificationRecord, progress, evidence]) => {
        setDetail(permitDetail);
        setVerified(Boolean(verificationRecord));
        setProgressCount(progress.length);
        setEvidenceCount(evidence.length);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load permit"))
      .finally(() => setLoading(false));
  }, [permitId]);

  function toggleChecklist(key: keyof VerificationChecklist, value: boolean) {
    setChecklist((current) => ({ ...current, [key]: value }));
  }

  async function handleVerify(offline: boolean) {
    if (!isChecklistComplete(checklist) || !comment.trim()) {
      setError("Complete all checklist items and add a comment");
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
      setError("Complete the closure checklist and add a closure comment");
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

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  if (!detail) {
    return <Text style={styles.error}>{error ?? "Permit not found"}</Text>;
  }

  const closureLeft = stageAnswersLeft(detail.permit.formResponses ?? [], "closure", stageEdits);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{detail.permit.title}</Text>
      <Text style={styles.meta}>
        {progressCount} progress update(s) · {evidenceCount} evidence file(s)
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {!verified ? (
        <>
          <Text style={styles.sectionTitle}>Final inspection</Text>
          {(Object.keys(checklistLabels) as Array<keyof VerificationChecklist>).map((key) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowLabel}>{checklistLabels[key]}</Text>
              <Switch
                value={checklist[key]}
                onValueChange={(value) => toggleChecklist(key, value)}
              />
            </View>
          ))}
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Verification comment (required)"
            multiline
          />
          <StageAnswers
            responses={detail.permit.formResponses ?? []}
            stage="closure"
            edits={stageEdits}
            onChange={setStageEdits}
            signerName={signerName}
            disabled={submitting}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => handleVerify(false)}
            disabled={submitting || !isChecklistComplete(checklist) || !comment.trim()}
          >
            <Text style={styles.primaryButtonText}>Submit verification</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => handleVerify(true)}
            disabled={submitting || !isChecklistComplete(checklist)}
          >
            <Text style={styles.secondaryButtonText}>Save offline</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.message}>Verification complete. The HOD signs off and closes the permit.</Text>
          <Text style={styles.sectionTitle}>Final sign-off</Text>
          {(Object.keys(checklistLabels) as Array<keyof VerificationChecklist>).map((key) => (
            <View key={key} style={styles.row}>
              <Text style={styles.rowLabel}>{checklistLabels[key]}</Text>
              <Switch value={closeChecklist[key]} onValueChange={(value) => setCloseChecklist((c) => ({ ...c, [key]: value }))} />
            </View>
          ))}
          <StageAnswers
            responses={detail.permit.formResponses ?? []}
            stage="closure"
            edits={stageEdits}
            onChange={setStageEdits}
            signerName={signerName}
            disabled={submitting}
          />
          {closureLeft > 0 ? <Text style={styles.meta}>{`${closureLeft} left to sign before closing.`}</Text> : null}
          <TextInput style={styles.input} value={closeComment} onChangeText={setCloseComment} placeholder="Closure comment (required)" multiline />
          <Pressable
            style={styles.primaryButton}
            onPress={handleClose}
            disabled={submitting || closureLeft > 0 || !isChecklistComplete(closeChecklist) || !closeComment.trim()}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Closing..." : "Close permit"}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  title: { fontSize: 20, fontWeight: "600" },
  meta: { fontSize: 13, color: "#666" },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  rowLabel: { flex: 1, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "500" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#111827", fontWeight: "500" },
  error: { color: "#b91c1c" },
  message: { color: "#059669" },
});
