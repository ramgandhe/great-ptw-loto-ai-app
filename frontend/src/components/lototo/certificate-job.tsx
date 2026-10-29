"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CertificateCustody } from "@/components/lototo/certificate-custody";
import { IsolationPrint, IsolationPrintButtons } from "@/components/lototo/certificate-print";
import { PersonalLocks } from "@/components/lototo/personal-locks";
import { ErrorNote } from "@/components/safety/record-list";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { ENERGY_SOURCE_OPTIONS } from "@/lib/lototo/form-options";
import { ISOLATION_METHODS, PROOF_LABELS } from "@/lib/lototo/point-fields";
import {
  CERTIFICATE_WRITE_ROLES,
  applyCertificatePoint,
  certificateStatusLabel,
  getIsolationCertificate,
  pointPassed,
  recordCertificateProof,
  restoreCertificatePoint,
  transitionIsolationCertificate,
  type IsolationCertificate,
  type IsolationCertificatePoint,
} from "@/lib/lototo/certificates";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function energyLabel(value: string) {
  return ENERGY_SOURCE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function methodLabel(value: string | null) {
  return ISOLATION_METHODS.find((item) => item.value === value)?.label ?? value ?? "";
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function PointFacts({ point }: { point: IsolationCertificatePoint }) {
  const energy = point.energyType === "other" && point.energyOtherText
    ? point.energyOtherText
    : energyLabel(point.energyType);
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Energy</dt>
        <dd>{energy}{point.magnitude ? ` · ${point.magnitude}` : ""}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Method</dt>
        <dd>{methodLabel(point.method)} · {PROOF_LABELS[point.proof] ?? point.proof}</dd>
      </div>
      {point.locationText ? (
        <div>
          <dt className="text-muted-foreground">Where</dt>
          <dd>{point.locationText}</dd>
        </div>
      ) : null}
      {point.device ? (
        <div>
          <dt className="text-muted-foreground">Device</dt>
          <dd>{point.device}</dd>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <dt className="text-muted-foreground">Isolate</dt>
        <dd>{point.action || "No instruction recorded"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Normal position</dt>
        <dd>{point.normalPosition || "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Isolated position</dt>
        <dd>{point.isolatedPosition || "—"}</dd>
      </div>
      {point.drawingReference ? (
        <div>
          <dt className="text-muted-foreground">Drawing</dt>
          <dd>{point.drawingReference}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function PointSummary({ points }: { points: IsolationCertificatePoint[] }) {
  return (
    <ol className="grid gap-3">
      {points.map((point, index) => {
        const passed = pointPassed(point);
        const latest = point.proofs[point.proofs.length - 1];
        return (
          <li key={point.id} className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{index + 1}. {point.pointCode}</p>
            <p className="mt-1 text-sm">{passed ? "Passed" : latest?.result === "fail" ? "Last proof failed" : "Open"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {energyLabel(point.energyType)}
              {point.lockNumber ? ` · Lock ${point.lockNumber}` : ""}
              {point.tagNumber ? ` · Tag ${point.tagNumber}` : ""}
              {point.positionConfirmed ? ` · ${point.positionConfirmed}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function ApplyForm({
  point,
  busy,
  onApply,
}: {
  point: IsolationCertificatePoint;
  busy: boolean;
  onApply: (payload: { positionConfirmed: string; lockNumber: string; tagNumber: string }) => void;
}) {
  const [positionConfirmed, setPositionConfirmed] = useState(point.isolatedPosition ?? "");
  const [lockNumber, setLockNumber] = useState("");
  const [tagNumber, setTagNumber] = useState("");

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ positionConfirmed: positionConfirmed.trim(), lockNumber: lockNumber.trim(), tagNumber: tagNumber.trim() });
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Position confirmed</span>
        <input className={FIELD} value={positionConfirmed} onChange={(event) => setPositionConfirmed(event.target.value)} required />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Lock number</span>
        <input className={FIELD} value={lockNumber} onChange={(event) => setLockNumber(event.target.value)} required />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Tag number</span>
        <input className={FIELD} value={tagNumber} onChange={(event) => setTagNumber(event.target.value)} required />
      </label>
      <div>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Apply this point"}</Button>
      </div>
    </form>
  );
}

function proofGap(proof: string, readings: Record<string, unknown>, instrument: string, serial: string, calibration: string) {
  if (proof === "meter") {
    if (!instrument.trim() || !serial.trim() || !calibration) return "A meter proof needs the instrument, its serial number, and its calibration date.";
    if (readings.meterProved !== true || readings.equipmentDead !== true || readings.meterProvedAgain !== true) {
      return "Electrical proof is live, dead, then live again.";
    }
  }
  if (proof === "gauge") {
    if (!String(readings.reading ?? "").trim() || readings.ventOpen !== true || readings.bleedOpen !== true) {
      return "Pressure proof needs a gauge reading, an open vent, and an open bleed.";
    }
  }
  if (proof === "pin" && (readings.noMovement !== true || readings.pinInserted !== true)) {
    return "This point is proved by no movement and the pin in place.";
  }
  if (proof === "no_movement" && readings.noMovement !== true) return "This point is proved by no movement.";
  if (proof === "try_start" && (readings.attempted !== true || readings.didNotRun !== true)) {
    return "Try-start is proved when the start is attempted and the equipment does not run.";
  }
  if (proof === "temperature" && !String(readings.reading ?? "").trim()) return "Temperature proof needs a reading.";
  if (!["meter", "gauge", "pin", "no_movement", "try_start", "temperature"].includes(proof) && readings.confirmed !== true) {
    return "Confirm this proof before it can pass.";
  }
  return null;
}

function ProofForm({
  point,
  busy,
  onRecord,
}: {
  point: IsolationCertificatePoint;
  busy: boolean;
  onRecord: (result: "pass" | "fail", body: {
    readings: Record<string, unknown>;
    instrumentMakeModel?: string;
    instrumentSerialNo?: string;
    calibrationExpiryDate?: string;
    comment?: string;
  }) => void;
}) {
  const [readings, setReadings] = useState<Record<string, unknown>>({});
  const [instrument, setInstrument] = useState("");
  const [serial, setSerial] = useState("");
  const [calibration, setCalibration] = useState("");
  const [comment, setComment] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const flag = (key: string) => readings[key] === true;

  function body() {
    return {
      readings,
      instrumentMakeModel: instrument.trim() || undefined,
      instrumentSerialNo: serial.trim() || undefined,
      calibrationExpiryDate: calibration || undefined,
      comment: comment.trim() || undefined,
    };
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const gap = proofGap(point.proof, readings, instrument, serial, calibration);
        if (gap) {
          setLocalError(gap);
          return;
        }
        setLocalError(null);
        onRecord("pass", body());
      }}
    >
      <ErrorNote message={localError} />
      {point.proof === "meter" ? (
        <>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Instrument</span>
            <input className={FIELD} value={instrument} onChange={(event) => setInstrument(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Serial number</span>
            <input className={FIELD} value={serial} onChange={(event) => setSerial(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Calibration date</span>
            <input className={FIELD} type="date" value={calibration} onChange={(event) => setCalibration(event.target.value)} />
          </label>
          <Check label="Proved the meter on a live source" checked={flag("meterProved")} onChange={(value) => setReadings({ ...readings, meterProved: value })} />
          <Check label="Equipment is dead" checked={flag("equipmentDead")} onChange={(value) => setReadings({ ...readings, equipmentDead: value })} />
          <Check label="Proved the meter again" checked={flag("meterProvedAgain")} onChange={(value) => setReadings({ ...readings, meterProvedAgain: value })} />
        </>
      ) : null}
      {point.proof === "gauge" ? (
        <>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Gauge reading</span>
            <input
              className={FIELD}
              value={String(readings.reading ?? "")}
              onChange={(event) => setReadings({ ...readings, reading: event.target.value })}
              placeholder="0 is valid when the vent and bleed are open"
            />
          </label>
          <Check label="Vent is open" checked={flag("ventOpen")} onChange={(value) => setReadings({ ...readings, ventOpen: value })} />
          <Check label="Bleed is open" checked={flag("bleedOpen")} onChange={(value) => setReadings({ ...readings, bleedOpen: value })} />
        </>
      ) : null}
      {point.proof === "temperature" ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Temperature reading</span>
          <input className={FIELD} value={String(readings.reading ?? "")} onChange={(event) => setReadings({ ...readings, reading: event.target.value })} />
        </label>
      ) : null}
      {point.proof === "no_movement" || point.proof === "pin" ? (
        <Check label="No movement" checked={flag("noMovement")} onChange={(value) => setReadings({ ...readings, noMovement: value })} />
      ) : null}
      {point.proof === "pin" ? (
        <Check label="Pin or block is in place" checked={flag("pinInserted")} onChange={(value) => setReadings({ ...readings, pinInserted: value })} />
      ) : null}
      {point.proof === "try_start" ? (
        <>
          <Check label="Start was attempted" checked={flag("attempted")} onChange={(value) => setReadings({ ...readings, attempted: value })} />
          <Check label="Equipment did not run" checked={flag("didNotRun")} onChange={(value) => setReadings({ ...readings, didNotRun: value })} />
        </>
      ) : null}
      {!["meter", "gauge", "temperature", "no_movement", "pin", "try_start"].includes(point.proof) ? (
        <Check label="Proof confirmed" checked={flag("confirmed")} onChange={(value) => setReadings({ ...readings, confirmed: value })} />
      ) : null}
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Comment</span>
        <input className={FIELD} value={comment} onChange={(event) => setComment(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Pass"}</Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => onRecord("fail", body())}
        >
          Fail
        </Button>
      </div>
    </form>
  );
}

export function CertificateJob({ id }: { id: string }) {
  const { roles } = useAuthProfile();
  const canApply = hasAnyRole(roles, CERTIFICATE_WRITE_ROLES);
  const canProve = canApply || hasAnyRole(roles, ["safety-officer"]);
  const [certificate, setCertificate] = useState<IsolationCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getIsolationCertificate(id)
      .then(setCertificate)
      .catch((err) => setError(err instanceof ApiError ? err.message : "This isolation could not be loaded."));
  }, [id]);

  async function run(action: () => Promise<IsolationCertificate>) {
    setBusy(true);
    setError(null);
    try {
      setCertificate(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That step could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function startIsolation() {
    if (!certificate) return;
    setBusy(true);
    setError(null);
    try {
      let status = certificate.status;
      if (status === "draft" || status === "pending_approval") {
        await transitionIsolationCertificate(id, "approved");
        status = "approved";
      }
      if (status === "approved") {
        await transitionIsolationCertificate(id, "isolation_in_progress");
      }
      setCertificate(await getIsolationCertificate(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Isolation could not be started.");
    } finally {
      setBusy(false);
    }
  }

  if (!certificate) {
    return (
      <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
        <ErrorNote message={error} />
        {error ? null : <p className="text-sm text-muted-foreground">Loading isolation…</p>}
      </main>
    );
  }

  const points = [...certificate.points].sort((a, b) => a.sortOrder - b.sortOrder);
  const openIndex = points.findIndex((point) => !pointPassed(point));
  const current = openIndex >= 0 ? points[openIndex] : null;
  const isolating = certificate.status === "isolation_in_progress";
  const beforeStart = certificate.status === "draft" || certificate.status === "pending_approval" || certificate.status === "approved";
  const readyToRestore = certificate.status === "isolated_verified" || certificate.status === "sanction_for_test";
  const restoring = certificate.status === "restoration_in_progress";
  const restoreOrder = [...points].sort(
    (a, b) => (a.removeOrder ?? a.sortOrder) - (b.removeOrder ?? b.sortOrder) || a.sortOrder - b.sortOrder,
  );
  const nextRestore = restoreOrder.find((point) => !point.restoredAt);
  const place = certificate.asset?.name || certificate.workLocation?.pathText || certificate.workLocation?.name || "";
  const proved = points.filter(pointPassed).length;
  const latestFail = current?.proofs[current.proofs.length - 1]?.result === "fail";

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <div className="flex flex-col gap-6 print:hidden">
      <PageHeader
        title={certificate.title}
        description={`${certificate.certificateNumber}${place ? ` · ${place}` : ""} · ${certificateStatusLabel(certificate.status)}`}
        back={{ href: "/lototo", label: "Isolations" }}
        actions={points.length > 0 ? <IsolationPrintButtons points={points} /> : undefined}
      />
      <ErrorNote message={error} />
      <PersonalLocks certificateId={id} status={certificate.status} canOpen={canApply} />
      <CertificateCustody certificateId={id} status={certificate.status} points={points} canWrite={canApply} />
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">This certificate has no isolation points. Publish a procedure that includes a proof on every point, then start again.</p>
      ) : null}
      {beforeStart && points.length > 0 ? (
        <section className="grid max-w-3xl gap-4">
          <p className="text-sm text-muted-foreground">{points.length} points copied from the procedure. Apply them in order, then prove each one.</p>
          <PointSummary points={points} />
          {canProve ? (
            <div>
              <Button type="button" disabled={busy} onClick={() => void startIsolation()}>
                {busy ? "Starting…" : "Start isolation"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {isolating && current ? (
        <section className="grid max-w-3xl gap-4">
          <div>
            <p className="text-lg font-semibold">Point {openIndex + 1} of {points.length}</p>
            <p className="text-sm text-muted-foreground">{proved} proved · {current.pointCode}</p>
          </div>
          {latestFail ? <p className="text-sm">The last proof on this point failed. Record a passing proof to move on.</p> : null}
          <div className="rounded-xl border border-border bg-card p-4">
            <PointFacts point={current} />
          </div>
          {current.appliedAt ? (
            canProve ? (
              <ProofForm
                key={current.id}
                point={current}
                busy={busy}
                onRecord={(result, body) => void run(() => recordCertificateProof(id, current.id, { result, ...body }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Applied. A prover records the result.</p>
            )
          ) : canApply ? (
            <ApplyForm
              key={current.id}
              point={current}
              busy={busy}
              onApply={(payload) => void run(() => applyCertificatePoint(id, current.id, payload))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for this point to be applied.</p>
          )}
        </section>
      ) : null}
      {isolating && !current && points.length > 0 ? (
        <section className="grid max-w-3xl gap-4">
          <p className="text-sm">Every point has a passing proof.</p>
          <PointSummary points={points} />
          {canProve ? (
            <div>
              <Button type="button" disabled={busy} onClick={() => void run(() => transitionIsolationCertificate(id, "isolated_verified").then(() => getIsolationCertificate(id)))}>
                {busy ? "Saving…" : "Mark isolated"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {readyToRestore && points.length > 0 ? (
        <section className="grid max-w-3xl gap-4">
          <p className="text-sm">Every point is proved. The plant stays isolated until restoration, and restoration waits until every attached permit has finished.</p>
          <PointSummary points={points} />
          {canApply ? (
            <div>
              <Button type="button" disabled={busy} onClick={() => void run(() => transitionIsolationCertificate(id, "restoration_in_progress").then(() => getIsolationCertificate(id)))}>
                {busy ? "Starting…" : "Start restoration"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {restoring && nextRestore ? (
        <section className="grid max-w-3xl gap-4">
          <div>
            <p className="text-lg font-semibold">Restore {nextRestore.pointCode}</p>
            <p className="text-sm text-muted-foreground">{nextRestore.restoreAction || "Return this device to its normal position and remove the lock."}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <PointFacts point={nextRestore} />
          </div>
          {canApply ? (
            <div>
              <Button type="button" disabled={busy} onClick={() => void run(() => restoreCertificatePoint(id, nextRestore.id))}>
                {busy ? "Saving…" : "Restore this point"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for the isolation authority to restore this point.</p>
          )}
        </section>
      ) : null}
      {restoring && !nextRestore && points.length > 0 ? (
        <section className="grid max-w-3xl gap-4">
          <p className="text-sm">Every point is back in its normal position.</p>
          <PointSummary points={points} />
          {canApply ? (
            <div>
              <Button type="button" disabled={busy} onClick={() => void run(() => transitionIsolationCertificate(id, "restored_verified").then(() => getIsolationCertificate(id)))}>
                {busy ? "Saving…" : "Mark restored"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {!beforeStart && !isolating && !readyToRestore && !restoring && points.length > 0 ? (
        <section className="grid max-w-3xl gap-4">
          <PointSummary points={points} />
        </section>
      ) : null}
      </div>
      <IsolationPrint certificate={certificate} points={points} place={place} />
    </main>
  );
}
