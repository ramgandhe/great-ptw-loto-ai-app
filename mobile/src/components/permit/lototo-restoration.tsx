import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppText, Button, Card, CheckRow, SectionTitle, TextField } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  confirmPermitLototoPhase,
  getPermitLototoExecution,
  restartPermitLototoVerification,
  tickPermitLototoSequenceStep,
} from "@/lib/permit/api";
import type { PermitLototoExecutionBoard } from "@/lib/permit/types";
import { useTheme } from "@/providers/theme-provider";

/** Remove sequence the listed verifier completes after the work is marked complete. */
export function LototoRestoration({ permitId, onRestored }: { permitId: string; onRestored: () => void }) {
  const { tokens } = useTheme();
  const [board, setBoard] = useState<PermitLototoExecutionBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tryOut, setTryOut] = useState(false);
  const [signedName, setSignedName] = useState("");

  useEffect(() => {
    getPermitLototoExecution(permitId)
      .then(setBoard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load energy restoration"));
  }, [permitId]);

  async function save(work: () => Promise<PermitLototoExecutionBoard>) {
    setBusy(true);
    setError(null);
    try {
      const next = await work();
      setBoard(next);
      if (next.restored) onRestored();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save energy restoration");
    } finally {
      setBusy(false);
    }
  }

  if (error && !board) return <AppText variant="caption">{error}</AppText>;
  if (!board) return <AppText variant="caption">Loading energy restoration…</AppText>;
  if (board.restored) return null;

  const runs = board.instances.map((instance) => instance.removeRun ?? null);
  const anyFailed = runs.some((run) => run?.result === "fail");
  const allReady = board.instances.every((instance) => {
    const steps = instance.removeSteps ?? [];
    return Boolean(instance.removeRun?.canConfirm || (steps.length === 0 && instance.removeRun?.result !== "fail"));
  });

  return (
    <View style={{ gap: tokens.space[3] }}>
      <SectionTitle title="Energy restoration" />
      <AppText variant="caption">Tick each remove step in order, then confirm Pass. The receiver is asked to check the work after that.</AppText>
      {error ? <AppText variant="caption">{error}</AppText> : null}
      {board.instances.map((instance) => {
        const steps = instance.removeSteps ?? [];
        const run = instance.removeRun ?? null;
        const passed = run?.result === "pass";
        const failed = run?.result === "fail";
        return (
          <Card key={instance.instanceId} style={{ gap: tokens.space[2] }}>
            <AppText variant="body" weight="semibold">{instance.procedureCode} {instance.procedureTitle}</AppText>
            {steps.map((step) => {
              const ticked = run?.ticks.some((row) => row.sequenceStepId === step.id);
              const isNext = !passed && !failed && (run?.nextStepId ?? steps[0]?.id) === step.id;
              return (
                <View key={step.id} style={{ gap: tokens.space[1] }}>
                  <AppText variant="body">{step.sequenceOrder}. {step.title}</AppText>
                  {ticked ? <AppText variant="caption">Ticked</AppText> : isNext ? (
                    <CheckRow label="Done" value={false} disabled={busy} onChange={() => void save(() => tickPermitLototoSequenceStep(permitId, instance.instanceId, step.id))} />
                  ) : (
                    <AppText variant="caption">Tick previous steps first</AppText>
                  )}
                </View>
              );
            })}
          </Card>
        );
      })}
      {anyFailed ? (
        <Button label="Restart" disabled={busy} onPress={() => void save(async () => {
          let next = board;
          for (const instance of board.instances) {
            if (instance.removeRun?.result === "fail") next = await restartPermitLototoVerification(permitId, instance.instanceId);
          }
          return next;
        })} />
      ) : allReady ? (
        <Card style={{ gap: tokens.space[2] }}>
          <CheckRow label="Try-out completed" value={tryOut} onChange={setTryOut} disabled={busy} />
          <TextField label="Typed name" value={signedName} onChangeText={setSignedName} />
          <Button
            label="Pass"
            disabled={busy || !tryOut || !signedName.trim()}
            onPress={() => void save(async () => {
              let next = board;
              for (const instance of board.instances) {
                if (instance.removeRun?.result === "pass") continue;
                next = await confirmPermitLototoPhase(permitId, instance.instanceId, {
                  phase: "remove",
                  result: "pass",
                  tryOutCompleted: true,
                  signedName: signedName.trim(),
                });
              }
              return next;
            })}
          />
        </Card>
      ) : (
        <AppText variant="caption">Tick every remove step, then confirm.</AppText>
      )}
    </View>
  );
}
