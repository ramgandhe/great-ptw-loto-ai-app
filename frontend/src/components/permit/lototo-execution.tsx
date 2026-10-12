"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import {
  confirmPermitLototoPhase,
  getPermitLototoExecution,
  restartPermitLototoVerification,
  tickPermitLototoSequenceStep,
} from "@/lib/permit/api";
import { formatDateTime } from "@/lib/format";
import type {
  PermitLototoExecutionBoard,
  PermitLototoExecutionPoint,
  PermitLototoSequenceStep,
  PermitLototoVerificationRun,
} from "@/lib/permit/types";
import { Button } from "@/components/ui/button";
import { fieldClassName } from "@/components/permit/form-field";

export function PermitLototoExecution({
  permitId,
  onBoardChange,
}: {
  permitId: string;
  onBoardChange?: (board: PermitLototoExecutionBoard) => void;
}) {
  const { profile } = useAuthProfile();
  const [board, setBoard] = useState<PermitLototoExecutionBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPermitLototoExecution(permitId)
      .then((next) => {
        setBoard(next);
        onBoardChange?.(next);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load LOTOTO verification"));
  }, [permitId]);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }
  if (!board) {
    return <p className="text-sm text-muted-foreground">Loading LOTOTO verification…</p>;
  }
  if (board.instances.length === 0) {
    return null;
  }

  const userId = profile?.id;
  const canWrite = board.permitStatus === "approved" || board.permitStatus === "active";
  const canRestore = board.permitStatus === "execution_completed" || board.permitStatus === "pending_closure";
  const phase: "apply" | "remove" = canRestore ? "remove" : "apply";

  async function run(key: string, work: () => Promise<PermitLototoExecutionBoard>) {
    setBusy(key);
    setError(null);
    try {
      const next = await work();
      setBoard(next);
      onBoardChange?.(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save LOTOTO verification");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">LOTOTO verification</h2>
        <p className="text-sm text-muted-foreground">
          {canRestore
            ? board.restored
              ? "Removal sequence passed. Issuer verification can proceed."
              : "A listed verifier ticks each remove step in order, then confirms Pass or Fail."
            : board.isolated
              ? "Apply sequence passed. Work can start."
              : "A listed verifier ticks each apply step in order, then confirms Pass or Fail. Crew is recorded by name only."}
        </p>
      </div>
      {board.instances.map((instance) => {
        const runRow = phase === "remove" ? instance.removeRun : instance.applyRun;
        const steps = (phase === "remove" ? instance.removeSteps : instance.applySteps) ?? [];
        const failed = runRow?.result === "fail";
        const passed = runRow?.result === "pass";
        return (
          <div key={instance.instanceId} className="grid gap-3">
            <h3 className="text-sm font-semibold">
              {instance.procedureCode} {instance.procedureTitle}
            </h3>
            {(instance.crew ?? []).length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Crew: {instance.crew.map((row) => row.name).join(", ")}
              </p>
            ) : null}
            <PointList points={instance.points} />
            {steps.map((step) => (
              <SequenceStepRow
                key={step.id}
                step={step}
                run={runRow}
                isNext={!passed && !failed && (runRow?.nextStepId ?? steps[0]?.id) === step.id}
                canAct={(canWrite || canRestore) && !passed && !failed}
                busy={busy}
                userId={userId}
                onTick={(note, file) =>
                  void run(`${instance.instanceId}-${step.id}`, () =>
                    tickPermitLototoSequenceStep(permitId, instance.instanceId, {
                      sequenceStepId: step.id,
                      note,
                      file,
                    }),
                  )
                }
              />
            ))}
          </div>
        );
      })}
      <FinalConfirm
        board={board}
        phase={phase}
        canWrite={canWrite || canRestore}
        busy={busy}
        userId={userId}
        onRestart={() =>
          void run("restart", async () => {
            let next = board;
            for (const instance of board.instances) {
              const runRow = phase === "remove" ? instance.removeRun : instance.applyRun;
              if (runRow?.result === "fail") {
                next = await restartPermitLototoVerification(permitId, instance.instanceId, phase);
              }
            }
            return next;
          })
        }
        onConfirm={(payload) =>
          void run("confirm", async () => {
            let next = board;
            for (const instance of board.instances) {
              const runRow = phase === "remove" ? instance.removeRun : instance.applyRun;
              if (runRow?.result === "pass") {
                continue;
              }
              next = await confirmPermitLototoPhase(permitId, instance.instanceId, { ...payload, phase });
            }
            return next;
          })
        }
      />
    </section>
  );
}

function PointList({ points }: { points: PermitLototoExecutionPoint[] }) {
  if (points.length === 0) {
    return null;
  }
  return (
    <ul className="grid gap-1 text-sm">
      {points.map((point) => (
        <li key={point.basePointId ?? point.extraPointId} className="text-muted-foreground">
          {point.pointCode}
          {point.action ? ` — ${point.action}` : ""}
          {point.energyType ? ` · ${point.energyType}` : ""}
          {point.locationText ? ` · ${point.locationText}` : ""}
          {point.na ? ` · N/A${point.naReason ? `: ${point.naReason}` : ""}` : ""}
        </li>
      ))}
    </ul>
  );
}

function SequenceStepRow({
  step,
  run,
  isNext,
  canAct,
  busy,
  userId,
  onTick,
}: {
  step: PermitLototoSequenceStep;
  run: PermitLototoVerificationRun | null;
  isNext: boolean;
  canAct: boolean;
  busy: string | null;
  userId: string | undefined;
  onTick: (note?: string, file?: File | null) => void;
}) {
  const ticked = run?.ticks.some((row) => row.sequenceStepId === step.id);
  const next = isNext;
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const tick = run?.ticks.find((row) => row.sequenceStepId === step.id);
  return (
    <div className="grid gap-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">
        {step.sequenceOrder}. {step.title}
      </p>
      {step.action ? <p className="text-sm text-muted-foreground">{step.action}</p> : null}
      {ticked ? (
        <p className="text-sm">
          Ticked{tick?.tickedAt ? ` · ${formatDateTime(tick.tickedAt)}` : ""}
          {tick?.note ? ` — ${tick.note}` : ""}
        </p>
      ) : canAct && next ? (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!userId || busy !== null}
              checked={false}
              onChange={() => onTick(note.trim() || undefined, file)}
            />
            Done
          </label>
          <input
            className={fieldClassName}
            placeholder="Note (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Tick previous steps first</p>
      )}
    </div>
  );
}

function FinalConfirm({
  board,
  phase,
  canWrite,
  busy,
  userId,
  onConfirm,
  onRestart,
}: {
  board: PermitLototoExecutionBoard;
  phase: "apply" | "remove";
  canWrite: boolean;
  busy: string | null;
  userId: string | undefined;
  onConfirm: (payload: {
    result: "pass" | "fail";
    tryOutCompleted: boolean;
    signedName: string;
    lockTagId?: string;
    note?: string;
    file?: File | null;
  }) => void;
  onRestart: () => void;
}) {
  const [tryOut, setTryOut] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [lockTagId, setLockTagId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const runs = board.instances.map((instance) => (phase === "remove" ? instance.removeRun : instance.applyRun));
  const allPassed = runs.length > 0 && runs.every((run) => run?.result === "pass");
  const anyFailed = runs.some((run) => run?.result === "fail");
  const allReady = board.instances.every((instance) => {
    const steps = (phase === "remove" ? instance.removeSteps : instance.applySteps) ?? [];
    const run = phase === "remove" ? instance.removeRun : instance.applyRun;
    return Boolean(run?.canConfirm || (steps.length === 0 && run?.result !== "fail"));
  });
  const signed = runs.find((run) => run?.signedName);

  if (allPassed) {
    return (
      <p className="text-sm">
        Passed{signed?.signedName ? ` — ${signed.signedName}` : ""}
        {signed?.verifiedAt ? ` · ${formatDateTime(signed.verifiedAt)}` : ""}
      </p>
    );
  }
  if (anyFailed) {
    return (
      <div className="grid gap-2 rounded-lg border border-border p-3">
        <p className="text-sm">
          Failed{signed?.signedName ? ` — ${signed.signedName}` : ""}
          {signed?.verifiedAt ? ` · ${formatDateTime(signed.verifiedAt)}` : ""}
        </p>
        {canWrite ? (
          <Button type="button" disabled={!userId || busy === "restart"} onClick={onRestart}>
            Restart
          </Button>
        ) : null}
      </div>
    );
  }
  if (!canWrite || !allReady) {
    return <p className="text-sm text-muted-foreground">Tick every sequence step on every LOTOTO procedure, then confirm once at the bottom.</p>;
  }
  return (
    <div className="grid gap-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Final confirm</p>
      <p className="text-xs text-muted-foreground">Confirms every attached LOTOTO procedure together.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={tryOut} onChange={(event) => setTryOut(event.target.checked)} />
        Try-out completed
      </label>
      <input
        className={fieldClassName}
        placeholder="Typed name"
        value={signedName}
        onChange={(event) => setSignedName(event.target.value)}
      />
      <input
        className={fieldClassName}
        placeholder="Lock/tag ID (optional)"
        value={lockTagId}
        onChange={(event) => setLockTagId(event.target.value)}
      />
      <input
        className={fieldClassName}
        placeholder="Note (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Photo (optional)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!userId || busy === "confirm" || !tryOut || !signedName.trim()}
          onClick={() =>
            onConfirm({
              result: "pass",
              tryOutCompleted: true,
              signedName: signedName.trim(),
              lockTagId: lockTagId.trim() || undefined,
              note: note.trim() || undefined,
              file,
            })
          }
        >
          Pass
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!userId || busy === "confirm" || !signedName.trim()}
          onClick={() =>
            onConfirm({
              result: "fail",
              tryOutCompleted: tryOut,
              signedName: signedName.trim(),
              lockTagId: lockTagId.trim() || undefined,
              note: note.trim() || undefined,
              file,
            })
          }
        >
          Fail
        </Button>
      </div>
    </div>
  );
}
