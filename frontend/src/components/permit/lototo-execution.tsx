"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import {
  getPermitLototoExecution,
  recordPermitLototoCrew,
  recordPermitLototoRestore,
  recordPermitLototoRestoreVerify,
  recordPermitLototoVerify,
} from "@/lib/permit/api";
import type { PermitLototoExecutionBoard, PermitLototoExecutionPoint } from "@/lib/permit/types";
import { Button } from "@/components/ui/button";
import { fieldClassName } from "@/components/permit/form-field";

const STATUS_LABEL: Record<PermitLototoExecutionPoint["status"], string> = {
  na: "N/A",
  pending_crew: "Awaiting isolation",
  pending_verify: "Awaiting verification",
  failed: "Failed — redo isolation",
  passed: "Verified",
};

const RESTORE_STATUS_LABEL: Record<PermitLototoExecutionPoint["status"], string> = {
  na: "N/A",
  pending_crew: "Awaiting restoration",
  pending_verify: "Awaiting restoration verification",
  failed: "Failed — redo restoration",
  passed: "Restored",
};

function pointRef(point: PermitLototoExecutionPoint) {
  return point.basePointId ? { basePointId: point.basePointId } : { extraPointId: point.extraPointId ?? undefined };
}

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
  const [lockTagId, setLockTagId] = useState<Record<string, string>>({});
  const [tryOut, setTryOut] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPermitLototoExecution(permitId)
      .then((next) => {
        setBoard(next);
        onBoardChange?.(next);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load LOTOTO isolation"));
  }, [permitId]);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }
  if (!board) {
    return <p className="text-sm text-muted-foreground">Loading isolation…</p>;
  }
  if (board.instances.length === 0) {
    return null;
  }

  const userId = profile?.id;
  const canWrite = board.permitStatus === "approved" || board.permitStatus === "active";
  const canRestore = board.permitStatus === "execution_completed" || board.permitStatus === "pending_closure";

  async function run(key: string, work: () => Promise<PermitLototoExecutionBoard>) {
    setBusy(key);
    setError(null);
    try {
      const next = await work();
      setBoard(next);
      onBoardChange?.(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save isolation");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">{canRestore ? "LOTOTO restoration" : "LOTOTO isolation"}</h2>
        <p className="text-sm text-muted-foreground">
          {canRestore
            ? board.restored
              ? "Energy sources are restored. Issuer verification can proceed."
              : "Restore isolation points in reverse order. Crew record lock/tag removal. Verifiers confirm pass/fail. A fail sends that point back to crew."
            : board.isolated
                ? "Isolation and try-out are verified for every point."
                : "Crew apply locks. Verifiers confirm pass/fail and try-out. A fail sends that point back to crew."}
        </p>
      </div>
      {board.instances.map((instance) => (
        <div key={instance.instanceId} className="grid gap-3">
          <h3 className="text-sm font-semibold">
            {instance.procedureCode} {instance.procedureTitle}
          </h3>
          {!canRestore
            ? instance.points.map((point) => {
            const key = `${instance.instanceId}-${point.basePointId ?? point.extraPointId}`;
            return (
              <div key={key} className="grid gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {point.pointCode}
                    {point.action ? ` — ${point.action}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{STATUS_LABEL[point.status]}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {point.energyType}
                  {point.locationText ? ` · ${point.locationText}` : ""}
                </p>
                {point.na ? <p className="text-sm">N/A: {point.naReason}</p> : null}
                {point.crewLatest ? (
                  <p className="text-sm">Lock/tag {point.crewLatest.lockTagId}</p>
                ) : null}
                {point.verificationLatest ? (
                  <p className="text-sm">
                    Last check: {point.verificationLatest.result}
                    {point.verificationLatest.tryOutCompleted ? ", try-out done" : ""}
                  </p>
                ) : null}

                {canWrite && (point.status === "pending_crew" || point.status === "failed") ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      className={fieldClassName}
                      placeholder="Lock/tag ID"
                      value={lockTagId[key] ?? ""}
                      onChange={(event) => setLockTagId((current) => ({ ...current, [key]: event.target.value }))}
                    />
                    <Button
                      type="button"
                      disabled={!userId || busy === key || !(lockTagId[key] ?? "").trim()}
                      onClick={() =>
                        void run(key, () =>
                          recordPermitLototoCrew(permitId, instance.instanceId, {
                            ...pointRef(point),
                            lockTagId: (lockTagId[key] ?? "").trim(),
                          }),
                        )
                      }
                    >
                      Isolation complete
                    </Button>
                  </div>
                ) : null}

                {canWrite && point.status === "pending_verify" ? (
                  <div className="grid gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(tryOut[key])}
                        onChange={(event) => setTryOut((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                      Try-out completed
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={!userId || busy === key || !tryOut[key]}
                        onClick={() =>
                          void run(key, () =>
                            recordPermitLototoVerify(permitId, instance.instanceId, {
                              ...pointRef(point),
                              result: "pass",
                              tryOutCompleted: true,
                            }),
                          )
                        }
                      >
                        Pass
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={!userId || busy === key || !tryOut[key]}
                        onClick={() =>
                          void run(key, () =>
                            recordPermitLototoVerify(permitId, instance.instanceId, {
                              ...pointRef(point),
                              result: "fail",
                              tryOutCompleted: true,
                            }),
                          )
                        }
                      >
                        Fail
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
            : null}
          {canRestore
            ? [...instance.points].reverse().map((point) => {
                const key = `restore-${instance.instanceId}-${point.basePointId ?? point.extraPointId}`;
                return (
                  <div key={key} className="grid gap-2 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {point.pointCode} · {point.energyType}
                      </p>
                      <span className="text-xs text-muted-foreground">{RESTORE_STATUS_LABEL[point.restoreStatus]}</span>
                    </div>
                    {canRestore && (point.restoreStatus === "pending_crew" || point.restoreStatus === "failed") ? (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          className={fieldClassName}
                          placeholder="Lock / tag ID"
                          value={lockTagId[key] ?? ""}
                          onChange={(event) => setLockTagId((current) => ({ ...current, [key]: event.target.value }))}
                        />
                        <Button
                          type="button"
                          disabled={!userId || busy === key || !(lockTagId[key] ?? "").trim()}
                          onClick={() =>
                            void run(key, () =>
                              recordPermitLototoRestore(permitId, instance.instanceId, {
                                ...pointRef(point),
                                lockTagId: (lockTagId[key] ?? "").trim(),
                              }),
                            )
                          }
                        >
                          Restoration complete
                        </Button>
                      </div>
                    ) : null}
                    {canRestore && point.restoreStatus === "pending_verify" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={!userId || busy === key}
                          onClick={() =>
                            void run(key, () =>
                              recordPermitLototoRestoreVerify(permitId, instance.instanceId, {
                                ...pointRef(point),
                                result: "pass",
                              }),
                            )
                          }
                        >
                          Pass
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={!userId || busy === key}
                          onClick={() =>
                            void run(key, () =>
                              recordPermitLototoRestoreVerify(permitId, instance.instanceId, {
                                ...pointRef(point),
                                result: "fail",
                              }),
                            )
                          }
                        >
                          Fail
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            : null}
        </div>
      ))}
    </section>
  );
}
