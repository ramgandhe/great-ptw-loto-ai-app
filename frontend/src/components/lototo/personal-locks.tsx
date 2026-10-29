"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import {
  applyPersonalLock,
  getPersonalLocks,
  openLockbox,
  releaseLockbox,
  removePersonalLock,
  sealLockbox,
  type PersonalLocks,
} from "@/lib/lototo/personal-locks";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function displayName(profile: { firstName?: string; lastName?: string; displayName?: string | null; username: string } | null) {
  const named = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  return named || profile?.displayName || profile?.username || "Signed-in person";
}

export function PersonalLocks({
  certificateId,
  status,
  canOpen,
}: {
  certificateId: string;
  status: string;
  canOpen: boolean;
}) {
  const { profile } = useAuthProfile();
  const [detail, setDetail] = useState<PersonalLocks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [boxNumber, setBoxNumber] = useState("");
  const [masterLock, setMasterLock] = useState("");
  const [place, setPlace] = useState("");
  const [lockNumber, setLockNumber] = useState("");
  const [permitId, setPermitId] = useState("");

  function load() {
    return getPersonalLocks(certificateId).then(setDetail);
  }

  useEffect(() => {
    let cancelled = false;
    getPersonalLocks(certificateId)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Personal locks could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [certificateId]);

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

  if (!detail) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null;
  if (detail.personCount < 2 && !detail.lockbox) return null;

  const mine = detail.locks.find((lock) => lock.workforceUserId === profile?.id && !lock.removedAt);
  const stillOn = detail.locks.filter((lock) => !lock.removedAt);
  const sealed = detail.lockbox?.custodyStatus === "keys_deposited_sealed";
  const restoring = status === "restoration_in_progress" || status === "restored_verified" || status === "closed";
  const chosenPermit = permitId || detail.myPermits[0]?.id;

  return (
    <section className="grid max-w-3xl gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Personal locks</h2>
        <p className="text-sm text-muted-foreground">
          The device lock stays on the plant until restoration. Each person adds their own lock, and takes it off when they are clear.
        </p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {!detail.lockbox && canOpen ? (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => openLockbox(certificateId, {
              boxNumber: boxNumber.trim(),
              masterLockSerial: masterLock.trim(),
              locationDescription: place.trim() || undefined,
            }));
          }}
        >
          <p className="text-sm">More than one person is on this isolation. Open a lockbox so each person can add their lock.</p>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Box number</span>
            <input className={FIELD} value={boxNumber} onChange={(event) => setBoxNumber(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Master lock</span>
            <input className={FIELD} value={masterLock} onChange={(event) => setMasterLock(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Where the box is</span>
            <input className={FIELD} value={place} onChange={(event) => setPlace(event.target.value)} />
          </label>
          <div>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Open lockbox"}</Button>
          </div>
        </form>
      ) : null}
      {!detail.lockbox && !canOpen ? (
        <p className="text-sm text-muted-foreground">A lockbox is needed before you can add your lock.</p>
      ) : null}
      {detail.lockbox ? (
        <div className="grid gap-3 text-sm">
          <p>
            {detail.lockbox.boxNumber} · master lock {detail.lockbox.masterLockSerial}
            {detail.lockbox.locationDescription ? ` · ${detail.lockbox.locationDescription}` : ""}
          </p>
          {detail.lockbox.custodyStatus === "open_for_keys" && canOpen ? (
            <div>
              <p className="mb-2 text-muted-foreground">Put the device keys in the box, then seal it.</p>
              <Button type="button" disabled={busy} onClick={() => void run(() => sealLockbox(detail.lockbox!.id))}>
                {busy ? "Saving…" : "Seal the box"}
              </Button>
            </div>
          ) : null}
          {detail.lockbox.custodyStatus === "open_for_keys" && !canOpen ? (
            <p className="text-muted-foreground">Waiting for the device keys to be sealed in the box.</p>
          ) : null}
          {stillOn.length > 0 ? (
            <ul className="grid gap-1">
              {stillOn.map((lock) => (
                <li key={lock.id}>{lock.workerName} · {lock.personalLockNumber}</li>
              ))}
            </ul>
          ) : sealed ? (
            <p className="text-muted-foreground">No personal lock is on the box.</p>
          ) : null}
          {sealed && mine ? (
            <div>
              <Button type="button" disabled={busy} onClick={() => void run(() => removePersonalLock(detail.lockbox!.id, mine.id))}>
                {busy ? "Saving…" : "Take off my lock"}
              </Button>
            </div>
          ) : null}
          {sealed && !mine && detail.myPermits.length > 0 ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => applyPersonalLock(detail.lockbox!.id, {
                  personalLockNumber: lockNumber.trim(),
                  workerName: displayName(profile),
                  permitId: chosenPermit,
                }));
              }}
            >
              {detail.myPermits.length > 1 ? (
                <label className="grid gap-1">
                  <span className="font-medium">Permit this lock holds</span>
                  <select className={FIELD} value={chosenPermit} onChange={(event) => setPermitId(event.target.value)}>
                    {detail.myPermits.map((permit) => (
                      <option key={permit.id} value={permit.id}>{permit.reference || permit.title}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1">
                <span className="font-medium">My lock number</span>
                <input className={FIELD} value={lockNumber} onChange={(event) => setLockNumber(event.target.value)} required />
              </label>
              <div>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add my lock"}</Button>
              </div>
            </form>
          ) : null}
          {sealed && canOpen && stillOn.length === 0 && restoring ? (
            <div>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => releaseLockbox(detail.lockbox!.id))}>
                {busy ? "Saving…" : "Release the keys"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
