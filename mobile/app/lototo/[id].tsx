import { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  ActionBar,
  AppText,
  Banner,
  Button,
  Card,
  ChipRow,
  PageHeader,
  RefChip,
  Screen,
  ScreenState,
  SectionTitle,
  TextField,
  CheckRow,
} from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { getProfile } from "@/lib/auth/api";
import {
  applyCertificatePoint,
  applyPersonalLock,
  getIsolationCertificate,
  getPersonalLocks,
  pointPassed,
  recordCertificateProof,
  removePersonalLock,
  restoreCertificatePoint,
  transitionIsolationCertificate,
  uploadCertificateEvidence,
  type IsolationCertificate,
  type IsolationCertificatePoint,
  type PersonalLocks,
} from "@/lib/lototo/certificates";
import { useTheme } from "@/providers/theme-provider";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Waiting for approval",
  approved: "Ready",
  isolation_in_progress: "Isolating",
  isolated_verified: "Isolated",
  sanction_for_test: "Isolated · test",
  restoration_in_progress: "Restoring",
  restored_verified: "Restored",
  closed: "Closed",
};

async function capturePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new ApiError("Allow camera access to take an evidence photo.");
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || `evidence-${Date.now()}.jpg`,
    type: asset.mimeType || "image/jpeg",
  };
}

export default function LototoCertificateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfile>> | null>(null);
  const [certificate, setCertificate] = useState<IsolationCertificate | null>(null);
  const [locks, setLocks] = useState<PersonalLocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [positionConfirmed, setPositionConfirmed] = useState("");
  const [lockNumber, setLockNumber] = useState("");
  const [tagNumber, setTagNumber] = useState("");
  const [personalLockNumber, setPersonalLockNumber] = useState("");
  const [meterProved, setMeterProved] = useState(false);
  const [equipmentDead, setEquipmentDead] = useState(false);
  const [meterProvedAgain, setMeterProvedAgain] = useState(false);
  const [instrument, setInstrument] = useState("");
  const [serial, setSerial] = useState("");
  const [calibration, setCalibration] = useState("");
  const [reading, setReading] = useState("");
  const [ventOpen, setVentOpen] = useState(false);
  const [bleedOpen, setBleedOpen] = useState(false);
  const [noMovement, setNoMovement] = useState(false);
  const [pinInserted, setPinInserted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [didNotRun, setDidNotRun] = useState(false);

  function resetProofFields() {
    setMeterProved(false);
    setEquipmentDead(false);
    setMeterProvedAgain(false);
    setInstrument("");
    setSerial("");
    setCalibration("");
    setReading("");
    setVentOpen(false);
    setBleedOpen(false);
    setNoMovement(false);
    setPinInserted(false);
    setConfirmed(false);
    setAttempted(false);
    setDidNotRun(false);
  }

  function buildProofPayload(proof: string) {
    if (proof === "meter") {
      if (!instrument.trim() || !serial.trim() || !calibration.trim()) {
        throw new ApiError("A meter proof needs the instrument, its serial number, and its calibration date.");
      }
      if (!meterProved || !equipmentDead || !meterProvedAgain) {
        throw new ApiError("Electrical proof is live, dead, then live again.");
      }
      return {
        readings: { meterProved, equipmentDead, meterProvedAgain },
        instrumentMakeModel: instrument.trim(),
        instrumentSerialNo: serial.trim(),
        calibrationExpiryDate: calibration.trim(),
      };
    }
    if (proof === "gauge") {
      if (!reading.trim() || !ventOpen || !bleedOpen) {
        throw new ApiError("Pressure proof needs a gauge reading, an open vent, and an open bleed.");
      }
      return { readings: { reading: reading.trim(), ventOpen, bleedOpen } };
    }
    if (proof === "pin") {
      if (!noMovement || !pinInserted) {
        throw new ApiError("This point is proved by no movement and the pin in place.");
      }
      return { readings: { noMovement, pinInserted } };
    }
    if (proof === "no_movement") {
      if (!noMovement) throw new ApiError("This point is proved by no movement.");
      return { readings: { noMovement } };
    }
    if (proof === "try_start") {
      if (!attempted || !didNotRun) {
        throw new ApiError("Try-start is proved when the start is attempted and the equipment does not run.");
      }
      return { readings: { attempted, didNotRun } };
    }
    if (proof === "temperature") {
      if (!reading.trim()) throw new ApiError("Temperature proof needs a reading.");
      return { readings: { reading: reading.trim() } };
    }
    if (!confirmed) throw new ApiError("Confirm this proof before it can pass.");
    return { readings: { confirmed } };
  }

  const load = useCallback(async () => {
    if (!id) return;
    const [cert, personal] = await Promise.all([
      getIsolationCertificate(id),
      getPersonalLocks(id).catch(() => null),
    ]);
    setCertificate(cert);
    setLocks(personal);
  }, [id]);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfile(null));
    load()
      .catch((err) => setError(err instanceof ApiError ? err.message : "This isolation could not be loaded."))
      .finally(() => setLoading(false));
  }, [load]);

  async function run(action: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await load();
      if (ok) setMessage(ok);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That step could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const back = { label: "LOTOTO", href: "/lototo" };
  if (loading) return <ScreenState back={back} />;
  if (!certificate) {
    return (
      <Screen>
        <PageHeader title="Isolation" back={back} />
        <Banner tone="danger">{error || "Isolation not found."}</Banner>
      </Screen>
    );
  }

  const points = [...certificate.points].sort((a, b) => a.sortOrder - b.sortOrder);
  const openIndex = points.findIndex((point) => !pointPassed(point));
  const current = openIndex >= 0 ? points[openIndex] : null;
  const isolating = certificate.status === "isolation_in_progress";
  const beforeStart =
    certificate.status === "draft" ||
    certificate.status === "pending_approval" ||
    certificate.status === "approved";
  const readyToRestore =
    certificate.status === "isolated_verified" || certificate.status === "sanction_for_test";
  const restoring = certificate.status === "restoration_in_progress";
  const restoreOrder = [...points].sort(
    (a, b) => (a.removeOrder ?? a.sortOrder) - (b.removeOrder ?? b.sortOrder) || a.sortOrder - b.sortOrder,
  );
  const nextRestore = restoreOrder.find((point) => !point.restoredAt);
  const place = certificate.asset?.name || certificate.workLocation?.pathText || certificate.workLocation?.name || "";
  const requireEvidence = Boolean(certificate.options?.requireEvidencePhoto);
  const shared =
    (locks?.personCount ?? 0) >= 2 || (locks?.attachedPermitCount ?? 0) >= 2 || Boolean(locks?.lockbox);
  const mine = locks?.locks.find((lock) => lock.workforceUserId === profile?.id && !lock.removedAt);
  const sealed = locks?.lockbox?.custodyStatus === "keys_deposited_sealed";
  const applySteps = (certificate.sequenceSteps ?? [])
    .filter((step) => step.phase === "apply")
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const removeSteps = (certificate.sequenceSteps ?? [])
    .filter((step) => step.phase === "remove")
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  function InfoBlock({ point }: { point: IsolationCertificatePoint }) {
    return (
      <Card>
        <AppText variant="subheading">{point.pointCode}</AppText>
        <AppText variant="caption">
          {point.energyType}
          {point.magnitude ? ` · ${point.magnitude}` : ""}
          {point.device ? ` · ${point.device}` : ""}
        </AppText>
        {point.locationText ? <AppText variant="body">{point.locationText}</AppText> : null}
        <AppText variant="body">{point.action || "No isolate instruction recorded"}</AppText>
        {point.restoreAction ? <AppText variant="caption">Restore: {point.restoreAction}</AppText> : null}
        {point.infoPhoto?.url ? (
          <Image source={{ uri: point.infoPhoto.url }} style={{ width: "100%", height: 160, borderRadius: 8 }} resizeMode="contain" />
        ) : null}
      </Card>
    );
  }

  return (
    <Screen
      footer={
        beforeStart ? (
          <ActionBar>
            <Button
              label={busy ? "Starting…" : "Start isolation"}
              size="lg"
              loading={busy}
              onPress={() =>
                void run(async () => {
                  let status = certificate.status;
                  if (status === "draft" || status === "pending_approval") {
                    await transitionIsolationCertificate(certificate.id, "approved");
                    status = "approved";
                  }
                  if (status === "approved") {
                    await transitionIsolationCertificate(certificate.id, "isolation_in_progress");
                  }
                }, "Isolation started")
              }
            />
          </ActionBar>
        ) : isolating && current && !current.appliedAt ? (
          <ActionBar>
            <Button
              label={busy ? "Saving…" : "Apply this point"}
              size="lg"
              loading={busy}
              onPress={() =>
                void run(async () => {
                  if (requireEvidence) {
                    const photo = await capturePhoto();
                    if (!photo) throw new ApiError("An evidence photo is required.");
                    await uploadCertificateEvidence(certificate.id, current.id, "apply", photo);
                  }
                  await applyCertificatePoint(certificate.id, current.id, {
                    positionConfirmed: positionConfirmed.trim() || current.isolatedPosition || "Isolated",
                    lockNumber: current.method === "tag_only" ? undefined : lockNumber.trim(),
                    tagNumber: tagNumber.trim(),
                  });
                  setLockNumber("");
                  setTagNumber("");
                  setPositionConfirmed("");
                }, "Point applied")
              }
            />
          </ActionBar>
        ) : isolating && current && current.appliedAt ? (
          <ActionBar>
            <Button
              label={busy ? "Saving…" : "Pass proof"}
              size="lg"
              loading={busy}
              onPress={() =>
                void run(async () => {
                  const payload = buildProofPayload(current.proof);
                  if (requireEvidence) {
                    const photo = await capturePhoto();
                    if (!photo) throw new ApiError("An evidence photo is required.");
                    await uploadCertificateEvidence(certificate.id, current.id, "proof", photo);
                  }
                  await recordCertificateProof(certificate.id, current.id, { result: "pass", ...payload });
                  resetProofFields();
                }, "Proof passed")
              }
            />
          </ActionBar>
        ) : isolating && !current ? (
          <ActionBar>
            <Button
              label={busy ? "Saving…" : "Mark isolated"}
              size="lg"
              loading={busy}
              onPress={() => void run(() => transitionIsolationCertificate(certificate.id, "isolated_verified"), "Marked isolated")}
            />
          </ActionBar>
        ) : readyToRestore ? (
          <ActionBar>
            <Button
              label={busy ? "Starting…" : "Start restoration"}
              size="lg"
              loading={busy}
              onPress={() => void run(() => transitionIsolationCertificate(certificate.id, "restoration_in_progress"), "Restoration started")}
            />
          </ActionBar>
        ) : restoring && nextRestore ? (
          <ActionBar>
            <Button
              label={busy ? "Saving…" : "Restore this point"}
              size="lg"
              loading={busy}
              onPress={() =>
                void run(async () => {
                  if (requireEvidence) {
                    const photo = await capturePhoto();
                    if (!photo) throw new ApiError("An evidence photo is required.");
                    await uploadCertificateEvidence(certificate.id, nextRestore.id, "restore", photo);
                  }
                  await restoreCertificatePoint(certificate.id, nextRestore.id);
                }, "Point restored")
              }
            />
          </ActionBar>
        ) : restoring && !nextRestore ? (
          <ActionBar>
            <Button
              label={busy ? "Saving…" : "Mark restored"}
              size="lg"
              loading={busy}
              onPress={() => void run(() => transitionIsolationCertificate(certificate.id, "restored_verified"), "Marked restored")}
            />
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader
        title={certificate.title}
        description={`${certificate.certificateNumber}${place ? ` · ${place}` : ""} · ${STATUS_LABELS[certificate.status] ?? certificate.status}`}
        back={back}
      />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {message ? <Banner tone="success">{message}</Banner> : null}

      {readyToRestore || certificate.status === "isolated_verified" ? (
        <Banner tone="info">Apply steps are already passed on this isolation. Add your personal lock before you work.</Banner>
      ) : null}

      {shared && locks ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Personal locks" />
          <Card>
            {locks.lockbox ? (
              <AppText variant="caption">
                {locks.lockbox.boxNumber} · {locks.lockbox.custodyStatus.replace(/_/g, " ")}
              </AppText>
            ) : (
              <AppText variant="caption">A lockbox is needed when more than one person is on this isolation.</AppText>
            )}
            {locks.locks.filter((lock) => !lock.removedAt).map((lock) => (
              <AppText key={lock.id} variant="body">
                {lock.workerName} · {lock.personalLockNumber}
              </AppText>
            ))}
            {sealed && mine ? (
              <Button
                label="Take off my lock"
                variant="outline"
                loading={busy}
                onPress={() => void run(() => removePersonalLock(locks.lockbox!.id, mine.id), "Personal lock removed")}
              />
            ) : null}
            {sealed && !mine && locks.myPermits.length > 0 ? (
              <View style={{ gap: tokens.space[2] }}>
                <TextField label="My lock number" value={personalLockNumber} onChangeText={setPersonalLockNumber} />
                <Button
                  label="Add my lock"
                  loading={busy}
                  onPress={() =>
                    void run(
                      () =>
                        applyPersonalLock(locks.lockbox!.id, {
                          personalLockNumber: personalLockNumber.trim(),
                          workerName: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || "Worker",
                          permitId: locks.myPermits[0]?.id,
                        }),
                      "Personal lock added",
                    )
                  }
                />
              </View>
            ) : null}
            {sealed && !mine && locks.myPermits.length === 0 ? (
              <AppText variant="caption">Attach a permit that includes you before you can add a personal lock.</AppText>
            ) : null}
          </Card>
        </View>
      ) : null}

      {(isolating || beforeStart) && applySteps.length > 0 ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Apply sequence (info)" />
          {applySteps.map((step) => (
            <Card key={step.id}>
              <AppText variant="subheading">
                {step.sequenceOrder}. {step.title}
              </AppText>
              {step.infoText ? <AppText variant="caption">{step.infoText}</AppText> : null}
              {step.action ? <AppText variant="body">{step.action}</AppText> : null}
              {step.infoPhoto?.url ? (
                <Image source={{ uri: step.infoPhoto.url }} style={{ width: "100%", height: 140, borderRadius: 8 }} resizeMode="contain" />
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {(readyToRestore || restoring) && removeSteps.length > 0 ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Remove sequence (info)" />
          {removeSteps.map((step) => (
            <Card key={step.id}>
              <AppText variant="subheading">
                {step.sequenceOrder}. {step.title}
              </AppText>
              {step.infoText ? <AppText variant="caption">{step.infoText}</AppText> : null}
              {step.infoPhoto?.url ? (
                <Image source={{ uri: step.infoPhoto.url }} style={{ width: "100%", height: 140, borderRadius: 8 }} resizeMode="contain" />
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {beforeStart ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Points" count={points.length} />
          {points.map((point) => (
            <Card key={point.id}>
              <ChipRow>
                <RefChip reference={point.pointCode} />
                <AppText variant="caption">{pointPassed(point) ? "Passed" : "Open"}</AppText>
              </ChipRow>
              <AppText variant="caption">{point.energyType}</AppText>
            </Card>
          ))}
        </View>
      ) : null}

      {isolating && current ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title={`Point ${openIndex + 1} of ${points.length}`} />
          <InfoBlock point={current} />
          {!current.appliedAt ? (
            <Card>
              <TextField
                label="Position confirmed"
                value={positionConfirmed}
                onChangeText={setPositionConfirmed}
                placeholder={current.isolatedPosition || "Isolated"}
              />
              {current.method === "tag_only" ? (
                <AppText variant="caption">Tag-only point. A lock number is not required.</AppText>
              ) : (
                <TextField label="Lock number" value={lockNumber} onChangeText={setLockNumber} />
              )}
              <TextField label="Tag number" value={tagNumber} onChangeText={setTagNumber} />
              {requireEvidence ? <AppText variant="caption">An evidence photo will be taken when you apply.</AppText> : null}
            </Card>
          ) : (
            <Card>
              <AppText variant="body">Proof: {current.proof}</AppText>
              {current.proof === "meter" ? (
                <>
                  <TextField label="Instrument make / model" value={instrument} onChangeText={setInstrument} />
                  <TextField label="Instrument serial" value={serial} onChangeText={setSerial} />
                  <TextField label="Calibration expiry (YYYY-MM-DD)" value={calibration} onChangeText={setCalibration} />
                  <CheckRow label="Proved the meter on a live source" value={meterProved} onChange={setMeterProved} />
                  <CheckRow label="Equipment is dead" value={equipmentDead} onChange={setEquipmentDead} />
                  <CheckRow label="Proved the meter again" value={meterProvedAgain} onChange={setMeterProvedAgain} />
                </>
              ) : current.proof === "gauge" ? (
                <>
                  <TextField label="Gauge reading" value={reading} onChangeText={setReading} />
                  <CheckRow label="Vent is open" value={ventOpen} onChange={setVentOpen} />
                  <CheckRow label="Bleed is open" value={bleedOpen} onChange={setBleedOpen} />
                </>
              ) : current.proof === "pin" ? (
                <>
                  <CheckRow label="No movement" value={noMovement} onChange={setNoMovement} />
                  <CheckRow label="Pin is in place" value={pinInserted} onChange={setPinInserted} />
                </>
              ) : current.proof === "no_movement" ? (
                <CheckRow label="No movement" value={noMovement} onChange={setNoMovement} />
              ) : current.proof === "try_start" ? (
                <>
                  <CheckRow label="Start was attempted" value={attempted} onChange={setAttempted} />
                  <CheckRow label="Equipment did not run" value={didNotRun} onChange={setDidNotRun} />
                </>
              ) : current.proof === "temperature" ? (
                <TextField label="Temperature reading" value={reading} onChangeText={setReading} />
              ) : (
                <CheckRow label="Proof confirmed" value={confirmed} onChange={setConfirmed} />
              )}
              {requireEvidence ? <AppText variant="caption">An evidence photo will be taken when you pass.</AppText> : null}
            </Card>
          )}
        </View>
      ) : null}

      {restoring && nextRestore ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title={`Restore ${nextRestore.pointCode}`} />
          <InfoBlock point={nextRestore} />
        </View>
      ) : null}

      {!beforeStart && !isolating && !restoring ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Points" count={points.length} />
          {points.map((point) => (
            <Card key={point.id}>
              <ChipRow>
                <RefChip reference={point.pointCode} />
                <AppText variant="caption">
                  {point.restoredAt ? "Restored" : pointPassed(point) ? "Passed" : "Open"}
                </AppText>
              </ChipRow>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
