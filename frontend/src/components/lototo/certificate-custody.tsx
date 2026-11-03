"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import {
  acceptHandover,
  createBlind,
  finishTest,
  getCustody,
  installBlind,
  listBlinds,
  markLongTerm,
  recordWalk,
  removeBlind,
  startTest,
  type IsolationBlind,
  type IsolationCustody,
} from "@/lib/lototo/custody";
import type { IsolationCertificatePoint } from "@/lib/lototo/certificates";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CertificateCustody({
  certificateId,
  status,
  points,
  canWrite,
}: {
  certificateId: string;
  status: string;
  points: IsolationCertificatePoint[];
  canWrite: boolean;
}) {
  const { profile } = useAuthProfile();
  const blindPoints = points.filter((point) => point.method === "blind");
  const isolated = status === "isolated_verified" || status === "sanction_for_test";
  const [custody, setCustody] = useState<IsolationCustody | null>(null);
  const [blinds, setBlinds] = useState<IsolationBlind[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blindTag, setBlindTag] = useState("");
  const [lineTag, setLineTag] = useState("");
  const [pointId, setPointId] = useState(blindPoints[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [opened, setOpened] = useState<string[]>([]);
  const [provedAgain, setProvedAgain] = useState(false);
  const [inspected, setInspected] = useState(false);
  const [notes, setNotes] = useState("");
  const [longTerm, setLongTerm] = useState(false);
  const [ltiReason, setLtiReason] = useState("");
  const [interval, setInterval] = useState("30");
  const [walkNotes, setWalkNotes] = useState("");

  function load() {
    const jobs: Array<Promise<unknown>> = [
      getCustody(certificateId).then((next) => {
        setCustody(next);
        setLongTerm(next.isLongTerm);
        setLtiReason(next.ltiReason ?? "");
        setInterval(String(next.ltiAuditIntervalDays || 30));
      }),
    ];
    if (blindPoints.length > 0) jobs.push(listBlinds(certificateId).then(setBlinds));
    return Promise.all(jobs);
  }

  useEffect(() => {
    let cancelled = false;
    load().catch((err) => {
      if (!cancelled) setError(err instanceof ApiError ? err.message : "Isolation details could not be loaded.");
    });
    return () => {
      cancelled = true;
    };
  }, [certificateId, blindPoints.length]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That step could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const openTest = custody?.tests.find((test) => test.status === "in_test");
  const active = status !== "draft" && status !== "pending_approval" && status !== "closed";

  return (
    <div className="grid max-w-3xl gap-4">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {blindPoints.length > 0 ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Blinds</h2>
          <p className="text-sm text-muted-foreground">Restoration stays blocked while a blind is installed.</p>
          <ul className="grid gap-1 text-sm">
            {blinds.map((blind) => (
              <li key={blind.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{blind.blindTagNumber} · {blind.lineTagNumber} · {blind.status === "installed_torqued" ? "Installed" : blind.status === "removal_verified" ? "Removed" : "Planned"}</span>
                {canWrite && blind.status === "planned" ? (
                  <Button type="button" size="sm" disabled={busy} onClick={() => void run(() => installBlind(blind.id))}>Installed</Button>
                ) : null}
                {canWrite && blind.status === "installed_torqued" ? (
                  <Button type="button" size="sm" disabled={busy} onClick={() => void run(() => removeBlind(blind.id))}>Removed</Button>
                ) : null}
              </li>
            ))}
          </ul>
          {canWrite ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => createBlind(certificateId, {
                  blindTagNumber: blindTag.trim(),
                  lineTagNumber: lineTag.trim(),
                  pointId: pointId || undefined,
                  blindType: "slip_blind",
                }));
              }}
            >
              {blindPoints.length > 1 ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Point</span>
                  <select className={FIELD} value={pointId} onChange={(event) => setPointId(event.target.value)}>
                    {blindPoints.map((point) => (
                      <option key={point.id} value={point.id}>{point.pointCode}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Blind tag</span>
                <input className={FIELD} value={blindTag} onChange={(event) => setBlindTag(event.target.value)} required />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Line</span>
                <input className={FIELD} value={lineTag} onChange={(event) => setLineTag(event.target.value)} required />
              </label>
              <div>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Record blind"}</Button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
      {isolated ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Test</h2>
          <p className="text-sm text-muted-foreground">The isolation stays Isolated while a test is open.</p>
          {openTest ? (
            canWrite ? (
              <form
                className="grid gap-3 text-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(() => finishTest(certificateId, openTest.id));
                }}
              >
                <p>{openTest.testReason}</p>
                {(() => {
                  const started = openTest.startedAt ? new Date(openTest.startedAt).getTime() : 0;
                  const opened = openTest.pointsTemporarilyDeisolated ?? [];
                  const waiting = points.filter((point) => {
                    if (!opened.includes(point.id)) return false;
                    return !point.proofs.some(
                      (proof) => proof.result === "pass" && new Date(proof.verifiedAt).getTime() >= started,
                    );
                  });
                  return waiting.length > 0 ? (
                    <p className="text-sm">
                      Re-prove these opened points on the isolation job before finishing:{" "}
                      {waiting.map((point) => point.pointCode).join(", ")}.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Opened points have a new passing proof.</p>
                  );
                })()}
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={provedAgain} onChange={(event) => setProvedAgain(event.target.checked)} />
                  <span>Zero energy is proved again on the opened points</span>
                </label>
                <div>
                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      !provedAgain ||
                      (openTest.pointsTemporarilyDeisolated ?? []).some((pointId) => {
                        const point = points.find((row) => row.id === pointId);
                        const started = openTest.startedAt ? new Date(openTest.startedAt).getTime() : 0;
                        return !point?.proofs.some(
                          (proof) => proof.result === "pass" && new Date(proof.verifiedAt).getTime() >= started,
                        );
                      })
                    }
                  >
                    {busy ? "Saving…" : "Finish the test"}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm">A test is open. {openTest.testReason}</p>
            )
          ) : canWrite ? (
            <form
              className="grid gap-3 text-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => startTest(certificateId, { testReason: reason.trim(), pointIds: opened }));
              }}
            >
              <label className="grid gap-1">
                <span className="font-medium">Reason</span>
                <input className={FIELD} value={reason} onChange={(event) => setReason(event.target.value)} required />
              </label>
              <div className="grid gap-1">
                {points.map((point) => (
                  <label key={point.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={opened.includes(point.id)}
                      onChange={(event) => setOpened((current) => event.target.checked ? [...current, point.id] : current.filter((id) => id !== point.id))}
                    />
                    <span>{point.pointCode}</span>
                  </label>
                ))}
              </div>
              <div>
                <Button type="submit" disabled={busy || opened.length === 0}>{busy ? "Saving…" : "Start a test"}</Button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
      {active && custody ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Handover</h2>
          {custody.authorityId === profile?.id ? (
            <p className="text-sm text-muted-foreground">Someone else accepts this isolation after the joint inspection.</p>
          ) : canWrite ? (
            <form
              className="grid gap-3 text-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => acceptHandover(certificateId, notes.trim()));
              }}
            >
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={inspected} onChange={(event) => setInspected(event.target.checked)} />
                <span>The points, locks and keys were inspected together</span>
              </label>
              <label className="grid gap-1">
                <span className="font-medium">Notes</span>
                <input className={FIELD} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <div>
                <Button type="submit" disabled={busy || !inspected}>{busy ? "Saving…" : "Accept this isolation"}</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for the next authority to accept this isolation.</p>
          )}
        </section>
      ) : null}
      {active && custody ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Long-term isolation</h2>
          <p className="text-sm text-muted-foreground">
            {custody.isLongTerm
              ? `Walk every ${custody.ltiAuditIntervalDays} days.${custody.nextAuditDueDate ? ` Next walk ${custody.nextAuditDueDate.slice(0, 10)}.` : ""} A missed reminder leaves the status unchanged.`
              : "Mark this isolation when it will stay on for weeks."}
          </p>
          {custody.walks.length > 0 ? (
            <ul className="grid gap-1 text-sm">
              {custody.walks.map((walk) => (
                <li key={walk.id}>{walk.walkedAt.slice(0, 10)}{walk.notes ? ` · ${walk.notes}` : ""}</li>
              ))}
            </ul>
          ) : null}
          {canWrite ? (
            <>
              <form
                className="grid gap-3 text-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(() => markLongTerm(certificateId, {
                    isLongTerm: longTerm,
                    ltiReason: ltiReason.trim() || undefined,
                    ltiAuditIntervalDays: Number(interval) || 30,
                  }));
                }}
              >
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={longTerm} onChange={(event) => setLongTerm(event.target.checked)} />
                  <span>This isolation is long-term</span>
                </label>
                <label className="grid gap-1">
                  <span className="font-medium">Reason</span>
                  <input className={FIELD} value={ltiReason} onChange={(event) => setLtiReason(event.target.value)} />
                </label>
                <label className="grid gap-1">
                  <span className="font-medium">Walk interval in days</span>
                  <input className={FIELD} inputMode="numeric" value={interval} onChange={(event) => setInterval(event.target.value)} />
                </label>
                <div>
                  <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
                </div>
              </form>
              {custody.isLongTerm ? (
                <form
                  className="grid gap-3 text-sm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(() => recordWalk(certificateId, walkNotes.trim()));
                  }}
                >
                  <label className="grid gap-1">
                    <span className="font-medium">This walk</span>
                    <input className={FIELD} value={walkNotes} onChange={(event) => setWalkNotes(event.target.value)} />
                  </label>
                  <div>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => recordWalk(certificateId, walkNotes.trim()))}>
                      {busy ? "Saving…" : "Record this walk"}
                    </Button>
                  </div>
                </form>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
