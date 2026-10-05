import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import { ActionBar, AppText, Banner, Button, Card, ChoiceGroup, DateTimeField, EmptyState, InfoList, PageHeader, Screen, TextField, ToggleRow } from "@/components/ui";
import { CalendarClock, ChevronRight, Paperclip, Pencil, Plus, Save, Send } from "@/components/ui/icons";
import { formatWindow } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { createPermit, getPermit, isRevisionConflict, savePermitDraft, submitPermit, uploadPermitAttachment } from "@/lib/permit/api";
import {
  createEmptyPermitForm,
  formToSavePayload,
  PERMIT_WIZARD_STEPS,
  permitDetailToForm,
  shouldSaveExecutorPayload,
  toDateInputValue,
  toStoredStep,
  validateStep,
} from "@/lib/permit/form";
import {
  isOfflineError,
  isLocalPermitId,
  queuePermitMutation,
  saveLocalPermitDraft,
} from "@/lib/permit/offline";
import { countPendingSaves, getLocalIdMap } from "@/lib/offline";
import type { PermitDetail, PermitFormState } from "@/lib/permit/types";
import { isEditablePermitStatus } from "@/lib/permit/status";
import * as DocumentPicker from "expo-document-picker";
import { SelectField } from "@/components/ui/select-field";
import { TemplateFormFill } from "@/components/permit/template-form-fill";
import { applicableTemplates, missingFormAnswers, withPrefill, type TemplatePrefillSource } from "@/lib/permit/forms";
import { listLototoProcedures } from "@/lib/lototo/api";
import type { LototoProcedureListItem } from "@/lib/lototo/types";
import { listGasTesting, type GasTestingRecord } from "@/lib/master-data/api";
import {
  filterMachineryByWorkstation,
  formatOrgOptionLabel,
  formatWorkforceOptionLabel,
  loadPermitFormOptions,
} from "@/lib/permit/form-options";
import { mergeAfterConflict, resolveConflict, type FieldConflict } from "@/lib/permit/conflict";
import { useTheme } from "@/providers/theme-provider";

type PermitWizardProps = {
  mode: "create" | "edit";
  permitId?: string;
  initialDetail?: PermitDetail;
  initialForm?: PermitFormState;
};

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function PermitWizard({ mode, permitId, initialDetail, initialForm }: PermitWizardProps) {
  const { tokens } = useTheme();
  const [form, setForm] = useState<PermitFormState>(
    initialForm ?? (initialDetail ? permitDetailToForm(initialDetail) : createEmptyPermitForm()),
  );
  const [currentPermitId, setCurrentPermitId] = useState<string | undefined>(permitId);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);
  // The revision this form was loaded or last saved at; the server refuses saves made against an older one.
  const [revision, setRevision] = useState(initialDetail?.permit.draftRevision ?? 0);
  // The form as last loaded or saved: the common ancestor when someone else's save has to be merged in.
  const [base, setBase] = useState<PermitFormState>(() => (initialDetail ? permitDetailToForm(initialDetail) : initialForm ?? createEmptyPermitForm()));
  // Values both people changed differently; each needs a choice before saving again.
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [attachments, setAttachments] = useState(initialDetail?.attachments ?? []);
  const [formOptions, setFormOptions] = useState<Awaited<ReturnType<typeof loadPermitFormOptions>> | null>(
    null,
  );
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [machineryLototo, setMachineryLototo] = useState<LototoProcedureListItem[]>([]);
  const [workstationGasTesting, setWorkstationGasTesting] = useState<GasTestingRecord[]>([]);

  const filteredMachinery = useMemo(
    () => filterMachineryByWorkstation(formOptions?.machinery ?? [], form.workstationId),
    [formOptions?.machinery, form.workstationId],
  );

  useEffect(() => {
    loadPermitFormOptions()
      .then((options) => {
        setFormOptions(options);
        // On a new permit, a list with one entry needs no choosing.
        const only = (list: { id: string }[], id: string) => id || (mode === "create" && list.length === 1 ? list[0].id : "");
        setForm((current) => ({
          ...current,
          plantId: only(options.plants, current.plantId),
          departmentId: only(options.departments, current.departmentId),
          locationId: only(options.locations, current.locationId),
        }));
        setForm((current) => {
          if (current.executors.some((executor) => (executor.workforceUserId ?? "").trim())) {
            return current;
          }
          return {
            ...current,
            executors: [{ workforceUserId: options.executors[0]?.id ?? "", isPrimary: true }],
          };
        });
      })
      .catch(() => {
        setMessage("Failed to load form options");
      })
      .finally(() => setOptionsLoading(false));
  }, []);

  useEffect(() => {
    if (
      form.machineryId &&
      !filteredMachinery.some((item) => item.id === form.machineryId)
    ) {
      setForm((current) => ({ ...current, machineryId: "", lototoRequired: false, lototo: [] }));
    }
  }, [filteredMachinery, form.machineryId]);

  useEffect(() => {
    if (!form.machineryId) {
      setMachineryLototo([]);
      return;
    }
    listLototoProcedures({ machineryId: form.machineryId, published: true })
      .then(setMachineryLototo)
      .catch(() => setMachineryLototo([]));
  }, [form.machineryId]);

  useEffect(() => {
    if (!form.workstationId) {
      setWorkstationGasTesting([]);
      return;
    }
    listGasTesting(form.workstationId)
      .then(setWorkstationGasTesting)
      .catch(() => setWorkstationGasTesting([]));
  }, [form.workstationId]);

  const permitStatus = initialDetail?.permit.status ?? "draft";
  const isReadOnly = !isEditablePermitStatus(permitStatus);

  const forms = useMemo(() => applicableTemplates(formOptions?.templates ?? [], form.permitTypeId), [formOptions?.templates, form.permitTypeId]);
  // What the permit already says, for the check sheets' "fill from permit" fields.
  const prefillSources = useMemo((): Record<TemplatePrefillSource, string | number> => {
    const nameOf = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((row) => row.id === id)?.name ?? "";
    const crew = form.executors
      .map((e) => formOptions?.executors.find((o) => o.id === e.workforceUserId)?.name.replace(/ \(you\)$/, ""))
      .filter((name): name is string => Boolean(name));
    const place = [...new Set([nameOf(formOptions?.locations, form.locationId), nameOf(formOptions?.workstations, form.workstationId)].filter(Boolean))];
    return {
      department: nameOf(formOptions?.departments, form.departmentId),
      location: place.join(", "),
      equipment: nameOf(formOptions?.machinery, form.machineryId),
      "job-description": [form.title, form.workScope].filter((v) => v.trim()).join("\n\n"),
      "valid-from": form.plannedStartAt.slice(0, 10),
      "valid-to": form.plannedEndAt.slice(0, 10),
      "crew-names": crew.join(", "),
      "crew-count": crew.length || "",
    };
  }, [form, formOptions]);
  // Those answers are not asked again: they follow the permit and are saved with it.
  const fromPermit = useMemo(
    () => new Set((Object.keys(prefillSources) as TemplatePrefillSource[]).filter((key) => prefillSources[key] !== "")),
    [prefillSources],
  );
  const prefilled = useMemo(() => ({ ...form, formResponses: withPrefill(form.formResponses, forms, prefillSources) }), [form, forms, prefillSources]);

  const persistDraft = useCallback(async (): Promise<{ id: string; revision: number; queued: boolean }> => {
    const payload = formToSavePayload(prefilled, {
      executorOnly: shouldSaveExecutorPayload(formOptions?.userRoles ?? []),
    });
    let id = currentPermitId;
    let baseRevision = revision;
    // A permit created offline has a local id until its create syncs; then use the server id.
    if (id && isLocalPermitId(id)) {
      const serverId = (await getLocalIdMap()).get(id);
      if (serverId) {
        id = serverId;
        setCurrentPermitId(serverId);
      } else {
        // Created offline at revision 0; each save queued behind the create adds one.
        baseRevision = await countPendingSaves(`/permits/${id}`);
      }
    }

    try {
      if (isLocalPermitId(id)) {
        // Its create has not synced yet, so this save can only be queued behind it.
        throw new TypeError("Network request failed");
      }
      if (!id) {
        const created = await createPermit({
          permitTypeId: form.permitTypeId,
          title: form.title,
          workScope: form.workScope || undefined,
          currentStep: toStoredStep(form.currentStep),
        });
        // Keep the id before the follow-up save, so a failed save is retried as a save, not a second create.
        id = created.permit.id;
        baseRevision = created.permit.draftRevision;
        setCurrentPermitId(id);
        setRevision(baseRevision);
      }

      if (conflicts.length) {
        // Not the server's conflict code: this must not fetch and merge again.
        throw new ApiError("Choose which value to keep for each one listed above, then save again.", "CONFLICT_UNRESOLVED");
      }
      const saved = await savePermitDraft(id, { ...payload, expectedRevision: baseRevision });
      setBase(permitDetailToForm(saved));
      setRevision(saved.permit.draftRevision);
      setQueuedOffline(false);
      return { id, revision: saved.permit.draftRevision, queued: false };
    } catch (error) {
      if (isRevisionConflict(error) && id) {
        // Merge in the other person's save: their unrelated changes are kept, this person's are kept,
        // and values both changed are listed for a choice. Saving again stays an explicit step.
        const latest = await getPermit(id);
        const savedForm = permitDetailToForm(latest);
        const result = mergeAfterConflict(base, form, savedForm);
        setForm({ ...result.merged, currentStep: form.currentStep });
        setBase(savedForm);
        setConflicts(result.conflicts);
        setRevision(latest.permit.draftRevision);
        throw new ApiError(
          result.conflicts.length
            ? "Someone else saved this permit. Their other changes are now in the form and yours are kept. Choose which value to keep where you both changed it, then save again."
            : "Someone else saved this permit. Their changes are now in the form and yours are kept. Save again to save both.",
          "PERMIT_REVISION_CONFLICT",
          409,
        );
      }
      if (!isOfflineError(error)) {
        throw error;
      }

      const localId = id ?? createLocalId();
      await saveLocalPermitDraft(localId, form.title || "Untitled permit", payload);

      // A new permit is queued as one create with everything entered (it starts at revision 0).
      // Saves carry the revision they were made against; on replay a newer server copy makes
      // them fail visibly instead of overwriting it.
      if (id) {
        await queuePermitMutation({ method: "PATCH", path: `/permits/${id}`, payload: { ...payload, expectedRevision: baseRevision } });
      } else {
        await queuePermitMutation({ method: "POST", path: "/permits", payload, localRef: localId });
      }

      setCurrentPermitId(localId);
      setRevision(id ? baseRevision + 1 : 0);
      setQueuedOffline(true);
      // A queued save bumps the revision once when it replays; a create leaves it at 0.
      return { id: localId, revision: id ? baseRevision + 1 : 0, queued: true };
    }
  }, [currentPermitId, form, prefilled, formOptions?.userRoles, revision, base, conflicts.length]);

  const conflictLabel = (key: string) => {
    const [kind, a, b] = key.split(":");
    if (kind === "field") return a.replace(/Id$/, "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    const template = formOptions?.templates.find((t) => t.id === a);
    return `${template?.name ?? "Form"}: ${template?.config?.sections.flatMap((s) => s.fields).find((f) => f.id === b)?.label ?? b}`;
  };
  const describeValue = (value: unknown): string => {
    if (value === undefined || value === null || value === "") return "empty";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length === 0 ? "none" : `${value.length} item${value.length === 1 ? "" : "s"}`;
    if (typeof value === "object") return (value as { name?: string }).name ?? "set";
    const lists: (readonly { id: string; name: string }[] | undefined)[] = [formOptions?.permitTypes, formOptions?.plants, formOptions?.departments, formOptions?.locations, formOptions?.workstations, formOptions?.machinery];
    return lists.flatMap((list) => list ?? []).find((row) => row.id === value)?.name ?? String(value);
  };

  const handleSaveDraft = async () => {
    setIsBusy(true);
    setMessage(null);
    try {
      const saved = await persistDraft();
      setMessage(saved.queued ? "Draft saved on this phone. Pending server confirmation." : "Draft saved");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Failed to save draft");
    } finally {
      setIsBusy(false);
    }
  };


  const handlePickAttachment = async () => {
    if (!currentPermitId) {
      setMessage("Save the draft before uploading attachments");
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    setIsBusy(true);
    setMessage(null);
    try {
      const uploaded = await uploadPermitAttachment(currentPermitId, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
      });
      setAttachments((current) => [...current, uploaded]);
      setMessage("Attachment uploaded");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Failed to upload attachment");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmit = async () => {
    const allErrors = [...PERMIT_WIZARD_STEPS.flatMap((_, index) => validateStep(form, index)), ...missingFormAnswers(forms, prefilled.formResponses)];
    setErrors(allErrors);
    if (allErrors.length > 0) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      // Always save the current edits first; submit only after that save, at its revision.
      const { id, revision: savedRevision, queued } = await persistDraft();
      if (queued) {
        await queuePermitMutation({ method: "POST", path: `/permits/${id}/submit`, payload: { expectedRevision: savedRevision } });
        setMessage("Submission is waiting for the server. It is not submitted until it syncs.");
        router.replace("/permits");
        return;
      }

      await submitPermit(id, savedRevision);
      router.replace(`/permits/${id}`);
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        setErrors(error.details as string[]);
      }
      setMessage(error instanceof ApiError ? error.message : "Failed to submit permit");
    } finally {
      setIsBusy(false);
    }
  };

  const step = form.currentStep;
  const last = PERMIT_WIZARD_STEPS.length - 1;
  // Steps up to the furthest one reached can be revisited from the step bar; an existing permit opens all of them.
  const [reached, setReached] = useState(mode === "edit" ? last : step);
  const goTo = (next: number) => {
    setErrors([]);
    setReached((r) => Math.max(r, next));
    setForm((current) => ({ ...current, currentStep: next }));
  };
  const handleNext = () => {
    const stepErrors = isReadOnly ? [] : [...validateStep(form, step), ...(step === 4 ? missingFormAnswers(forms, prefilled.formResponses) : [])];
    setErrors(stepErrors);
    if (stepErrors.length === 0) goTo(step + 1);
  };

  const nameIn = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((row) => row.id === id)?.name;
  const hazardIds = form.hazards.map((h) => h.hazardCategoryId).filter(Boolean);
  const ppeIds = form.ppe.map((p) => p.ppeCatalogueId).filter(Boolean);
  const notSet = "Not set";
  const crewNames = form.executors.map((e) => nameIn(formOptions?.executors, e.workforceUserId ?? "")).filter(Boolean).join(", ");
  const reviewSections: { step: number; rows: [string, string][] }[] = [
    { step: 0, rows: [["Type", nameIn(formOptions?.permitTypes, form.permitTypeId) ?? notSet], ["Title", form.title || notSet], ["Work", form.workScope || "—"]] },
    {
      step: 1,
      rows: [
        ["Location", [nameIn(formOptions?.locations, form.locationId), nameIn(formOptions?.workstations, form.workstationId)].filter(Boolean).join(", ") || notSet],
        ["Machinery", nameIn(formOptions?.machinery, form.machineryId) ?? "—"],
        ["When", formatWindow(form.plannedStartAt || null, form.plannedEndAt || null)],
      ],
    },
    {
      step: 2,
      rows: [
        ["Hazards", hazardIds.map((id) => nameIn(formOptions?.hazards, id)).join(", ") || notSet],
        ["PPE", ppeIds.map((id) => nameIn(formOptions?.ppe, id)).join(", ") || notSet],
        ["Isolation", form.lototoRequired ? `${form.lototo.filter((l) => l.procedureId).length} procedure(s)` : "Not needed"],
        ["Gas testing", form.gasTestingRequired ? `${form.gasTesting.filter((g) => g.gasTestingCatalogueId).length} test(s)` : "Not needed"],
      ],
    },
    { step: 3, rows: [["Crew", crewNames || notSet]] },
    {
      step: 4,
      rows: forms.length
        ? forms.map((t) => {
            const left = missingFormAnswers([t], prefilled.formResponses).length ? "Answers missing" : "Done";
            return [t.name, left] as [string, string];
          })
        : [["Check sheets", "None for this type"]],
    },
  ];

  return (
    <Screen
      key={step}
      footer={
        <ActionBar>
          {step > 0 ? <Button label="Back" variant="outline" onPress={() => goTo(step - 1)} style={{ marginRight: "auto" }} /> : null}
          {!isReadOnly ? <Button label="Save draft" variant="secondary" icon={Save} loading={isBusy} onPress={() => void handleSaveDraft()} /> : null}
          {step < last ? (
            <Button label="Next" icon={ChevronRight} onPress={handleNext} />
          ) : !isReadOnly ? (
            <Button label="Submit" icon={Send} disabled={isBusy} onPress={() => void handleSubmit()} />
          ) : null}
        </ActionBar>
      }
    >
      <PageHeader
        title={mode === "create" ? "Create permit" : "Edit permit"}
        description={STEP_INTRO[step]}
        back={{ label: "Permits", href: "/permits" }}
      />
      <StepBar step={step} reached={reached} onPick={goTo} />

      {queuedOffline ? <Banner tone="warning" title="Saved on this phone">Not sent yet: the permit reaches the server when the connection returns.</Banner> : null}
      {errors.length > 0 ? (
        <Banner tone="danger" title={step === last ? "Complete these before submitting" : "Complete this step to continue"}>
          <View style={{ gap: 2 }}>
            {errors.map((error) => (
              <AppText key={error} variant="caption" tone="danger">{`• ${error}`}</AppText>
            ))}
          </View>
        </Banner>
      ) : null}
      {message ? <Banner tone="info">{message}</Banner> : null}
      {conflicts.map((item) => (
        <Banner key={item.key} tone="warning" title={conflictLabel(item.key)}>
          <AppText variant="caption">{`Saved: ${describeValue(item.saved)}`}</AppText>
          <AppText variant="caption">{`Yours: ${describeValue(item.yours)}`}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2], marginTop: tokens.space[2] }}>
            {(["yours", "saved"] as const).map((keep) => (
              <Button
                key={keep}
                label={keep === "yours" ? "Keep mine" : "Use saved"}
                variant={keep === "yours" ? "primary" : "outline"}
                size="sm"
                onPress={() => {
                  setForm((current) => resolveConflict(current, item, keep));
                  setConflicts((current) => current.filter((c) => c.key !== item.key));
                }}
              />
            ))}
          </View>
        </Banner>
      ))}

      {optionsLoading ? <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} /> : null}

      {step === 0 && !optionsLoading ? (
        <>
          <StepCard title="Type of work" description="Choose the one that fits best. It decides the checks that follow.">
            <ChoiceGroup
              options={(formOptions?.permitTypes ?? []).map((item) => ({ key: item.id, label: item.name, color: item.color ?? undefined, swatch: item.color ?? undefined }))}
              value={form.permitTypeId || null}
              disabled={isReadOnly}
              onChange={(permitTypeId) => setForm({ ...form, permitTypeId })}
            />
          </StepCard>
          <StepCard title="The job">
            <TextField label="Title" required value={form.title} editable={!isReadOnly} onChangeText={(value) => setForm({ ...form, title: value })} placeholder="For example: replace pump seal" />
            <TextField label="What will be done" multiline value={form.workScope} editable={!isReadOnly} onChangeText={(value) => setForm({ ...form, workScope: value })} placeholder="The steps, tools and anything unusual" />
          </StepCard>
        </>
      ) : null}

      {step === 1 && !optionsLoading ? (
        <>
          <StepCard title="Where">
            <SelectField
              label="Location"
              value={form.locationId}
              options={(formOptions?.locations ?? []).map((item) => ({ value: item.id, label: formatOrgOptionLabel(item) }))}
              placeholder="Choose location"
              required
              disabled={isReadOnly}
              onChange={(locationId) => setForm({ ...form, locationId })}
            />
            <SelectField
              label="Workstation"
              value={form.workstationId}
              options={(formOptions?.workstations ?? []).map((item) => ({ value: item.id, label: formatOrgOptionLabel(item) }))}
              placeholder="Optional"
              disabled={isReadOnly}
              onChange={(workstationId) =>
                setForm({
                  ...form,
                  workstationId,
                  gasTesting: workstationId === form.workstationId ? form.gasTesting : [],
                  gasTestingRequired: workstationId ? form.gasTestingRequired : false,
                })
              }
            />
            <SelectField
              label="Machinery"
              value={form.machineryId}
              options={filteredMachinery.map((item) => ({ value: item.id, label: formatOrgOptionLabel(item) }))}
              placeholder="Optional: needed for isolation"
              disabled={isReadOnly}
              onChange={(machineryId) =>
                setForm({
                  ...form,
                  machineryId,
                  lototo: machineryId === form.machineryId ? form.lototo : [],
                  lototoRequired: machineryId ? form.lototoRequired : false,
                })
              }
            />
            <SelectField
              label="Plant"
              value={form.plantId}
              options={(formOptions?.plants ?? []).map((item) => ({ value: item.id, label: formatOrgOptionLabel(item) }))}
              placeholder="Optional"
              disabled={isReadOnly}
              onChange={(plantId) => setForm({ ...form, plantId })}
            />
            <SelectField
              label="Department"
              value={form.departmentId}
              options={(formOptions?.departments ?? []).map((item) => ({ value: item.id, label: formatOrgOptionLabel(item) }))}
              placeholder="Optional"
              disabled={isReadOnly}
              onChange={(departmentId) => setForm({ ...form, departmentId })}
            />
          </StepCard>
          <StepCard title="When" description="Pick a common window, or set the start and end yourself.">
            {!isReadOnly ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
                {schedulePresets().map((preset) => (
                  <Button key={preset.label} label={preset.label} variant="outline" size="sm" icon={CalendarClock} onPress={() => setForm({ ...form, plannedStartAt: preset.start, plannedEndAt: preset.end })} />
                ))}
              </View>
            ) : null}
            <DateTimeField label="Start" required value={form.plannedStartAt} disabled={isReadOnly} onChange={(value) => setForm({ ...form, plannedStartAt: value })} />
            <DateTimeField label="End" required value={form.plannedEndAt} disabled={isReadOnly} onChange={(value) => setForm({ ...form, plannedEndAt: value })} />
          </StepCard>
        </>
      ) : null}

      {step === 2 && !optionsLoading ? (
        <>
          <StepCard title="Hazards" description="Tap every hazard present at this job.">
            <ChoiceGroup
              options={(formOptions?.hazards ?? []).map((item) => ({ key: item.id, label: item.name }))}
              value={hazardIds}
              disabled={isReadOnly}
              onChange={(id) => setForm({ ...form, hazards: toggleRow(form.hazards, "hazardCategoryId", id, { description: "" }) })}
            />
            {form.hazards.filter((h) => h.hazardCategoryId).map((hazard) => (
              <TextField
                key={hazard.hazardCategoryId}
                label={`How ${nameIn(formOptions?.hazards, hazard.hazardCategoryId)?.toLowerCase() ?? "it"} is controlled`}
                hint="Optional"
                value={hazard.description}
                editable={!isReadOnly}
                onChangeText={(description) => setForm({ ...form, hazards: form.hazards.map((h) => (h === hazard ? { ...h, description } : h)) })}
              />
            ))}
          </StepCard>
          <StepCard title="Protective equipment" description="Tap everything the crew must wear.">
            <ChoiceGroup
              options={(formOptions?.ppe ?? []).map((item) => ({ key: item.id, label: item.name }))}
              value={ppeIds}
              disabled={isReadOnly}
              onChange={(id) => setForm({ ...form, ppe: toggleRow(form.ppe, "ppeCatalogueId", id, { quantity: 1 }) })}
            />
          </StepCard>
          <StepCard title="Isolation and gas testing">
            <ToggleRow
              label="Isolation (LOTOTO) required"
              description={form.machineryId ? "Lock out the machinery's energy before work starts." : "Choose machinery in the previous step first."}
              value={form.lototoRequired}
              disabled={isReadOnly || !form.machineryId}
              onChange={(on) => setForm({ ...form, lototoRequired: on, lototo: on ? form.lototo : [] })}
            />
            {form.lototoRequired ? (
              machineryLototo.length === 0 ? (
                <AppText variant="caption">No LOTOTO procedures for this machinery.</AppText>
              ) : (
                <ChoiceGroup
                  label="Procedures"
                  options={machineryLototo.map((plan) => ({ key: plan.id, label: plan.title }))}
                  value={form.lototo.map((l) => l.procedureId).filter(Boolean)}
                  disabled={isReadOnly}
                  onChange={(id) =>
                    setForm({
                      ...form,
                      lototo: toggleRow(form.lototo, "procedureId", id, {
                        extraPoints: [],
                        stepNa: [],
                        crew: [],
                        verifiers: [],
                      }),
                    })
                  }
                />
              )
            ) : null}
            <ToggleRow
              label="Gas testing required"
              description={form.workstationId ? "Test the atmosphere at the workstation before work starts." : "Choose a workstation in the previous step first."}
              value={form.gasTestingRequired}
              disabled={isReadOnly || !form.workstationId}
              onChange={(on) => setForm({ ...form, gasTestingRequired: on, gasTesting: on ? form.gasTesting : [] })}
            />
            {form.gasTestingRequired ? (
              workstationGasTesting.length === 0 ? (
                <AppText variant="caption">No gas tests set up for this workstation.</AppText>
              ) : (
                <ChoiceGroup
                  label="Gas tests"
                  options={workstationGasTesting.map((row) => ({ key: row.id, label: `${row.parameter} (${row.minimum}–${row.maximum} ${row.unit})` }))}
                  value={form.gasTesting.map((g) => g.gasTestingCatalogueId).filter(Boolean)}
                  disabled={isReadOnly}
                  onChange={(id) => setForm({ ...form, gasTesting: toggleRow(form.gasTesting, "gasTestingCatalogueId", id, {}) })}
                />
              )
            ) : null}
          </StepCard>
        </>
      ) : null}

      {step === 3 && !optionsLoading ? (
        <StepCard title="Who does the work" description="The first person leads the crew on site.">
          {form.executors.map((executor, index) => (
            <SelectField
              key={`executor-${index}`}
              label={index === 0 ? "Crew lead" : `Crew member ${index}`}
              value={executor.workforceUserId}
              options={(formOptions?.executors ?? []).map((person) => ({ value: person.id, label: formatWorkforceOptionLabel(person) }))}
              placeholder="Choose person"
              required={index === 0}
              disabled={isReadOnly}
              onChange={(workforceUserId) => {
                const executors = [...form.executors];
                executors[index] = { ...executor, workforceUserId };
                setForm({ ...form, executors });
              }}
            />
          ))}
          <Button label="Add crew member" variant="outline" size="sm" icon={Plus} disabled={isReadOnly} style={{ alignSelf: "flex-start" }} onPress={() => setForm({ ...form, executors: [...form.executors, { workforceUserId: "", isPrimary: false }] })} />
        </StepCard>
      ) : null}

      {step === 4 && !optionsLoading ? (
        forms.length === 0 ? (
          <EmptyState title="No check sheets for this type of work" body="Continue to review and submit." done />
        ) : (
          forms.map((template) => (
            <TemplateFormFill
              key={template.id}
              name={template.name}
              config={template.config!}
              answers={prefilled.formResponses[template.id] ?? {}}
              disabled={isReadOnly}
              signerName={formOptions?.userName ?? ""}
              fromPermit={fromPermit}
              onChange={(answers) => setForm({ ...form, formResponses: { ...form.formResponses, [template.id]: answers } })}
            />
          ))
        )
      ) : null}

      {step === last && !optionsLoading ? (
        <>
          {reviewSections.map((section) => (
            <StepCard
              key={section.step}
              title={PERMIT_WIZARD_STEPS[section.step]}
              action={isReadOnly ? undefined : <Button label="Change" variant="ghost" size="sm" icon={Pencil} onPress={() => goTo(section.step)} />}
            >
              <InfoList rows={section.rows} />
            </StepCard>
          ))}
          <StepCard title="Attachments">
            {attachments.length === 0 ? (
              <AppText variant="caption">No attachments yet.</AppText>
            ) : (
              attachments.map((attachment) => (
                <View key={attachment.id} style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[2] }}>
                  <Paperclip size={14} color={tokens.colors.mutedForeground} />
                  <AppText variant="body">{attachment.fileName}</AppText>
                </View>
              ))
            )}
            {!isReadOnly ? (
              currentPermitId ? (
                <Button label="Add attachment" variant="outline" size="sm" icon={Paperclip} disabled={isBusy} style={{ alignSelf: "flex-start" }} onPress={() => void handlePickAttachment()} />
              ) : (
                <AppText variant="caption">Save the draft to add photos or documents.</AppText>
              )
            ) : null}
          </StepCard>
        </>
      ) : null}
    </Screen>
  );
}

const STEP_INTRO = [
  "What kind of work, and what it is.",
  "Where the work happens, and when.",
  "The hazards on site and how the crew is protected.",
  "The people doing the work.",
  "The check sheets for this type of work. Answers the permit already gives are filled in for you.",
  "Check everything, then submit for approval.",
];

const localInput = (date: Date) => toDateInputValue(date.toISOString());

/** Tap-to-toggle over a list of rows keyed by one ID field; rows with no ID chosen yet are dropped. */
function toggleRow<K extends string, R extends Record<K, string>>(rows: R[], key: K, id: string, rest: Omit<R, K>): R[] {
  const chosen = rows.filter((row) => row[key]);
  return chosen.some((row) => row[key] === id) ? chosen.filter((row) => row[key] !== id) : [...chosen, { ...rest, [key]: id } as R];
}

/** One-tap schedules for the common cases, as on the web. */
function schedulePresets(now = new Date()): { label: string; start: string; end: string }[] {
  const soon = new Date(now);
  soon.setMinutes(soon.getMinutes() < 30 ? 30 : 60, 0, 0);
  const soonEnd = new Date(soon.getTime() + 8 * 3_600_000);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(16, 0, 0, 0);
  const weekEnd = new Date(tomorrowEnd);
  weekEnd.setDate(weekEnd.getDate() + 4);
  return [
    { label: "Today, next 8 hours", start: localInput(soon), end: localInput(soonEnd) },
    { label: "Tomorrow, 08:00–16:00", start: localInput(tomorrow), end: localInput(tomorrowEnd) },
    { label: "5 days from tomorrow", start: localInput(tomorrow), end: localInput(weekEnd) },
  ];
}

/** Where the person is in the form: done steps ticked, the current one ringed; reached steps can be tapped. */
function StepBar({ step, reached, onPick }: { step: number; reached: number; onPick: (step: number) => void }) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  return (
    <View style={{ gap: tokens.space[2] }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {PERMIT_WIZARD_STEPS.map((name, index) => {
          const current = index === step;
          const done = index < step;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`Step ${index + 1}: ${name}${done ? ", done" : current ? ", current" : ""}`}
              accessibilityState={{ selected: current, disabled: index > reached }}
              disabled={index > reached || current}
              onPress={() => onPick(index)}
              hitSlop={{ top: 12, bottom: 12 }}
              style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: done || current ? c.primaryFill : c.inputFill, borderWidth: done || current ? 0 : 1, borderColor: c.inputBorder }}
            />
          );
        })}
      </View>
      <AppText variant="label" tone="secondary">{`Step ${step + 1} of ${PERMIT_WIZARD_STEPS.length}: ${PERMIT_WIZARD_STEPS[step]}`}</AppText>
    </View>
  );
}

/** One part of a step: a card with its title, an optional line under it and an optional action. */
function StepCard({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <Card style={{ gap: tokens.space[4] }}>
      <View style={{ gap: tokens.space[1] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2] }}>
          <AppText variant="title" style={{ flex: 1 }}>{title}</AppText>
          {action}
        </View>
        {description ? <AppText variant="caption">{description}</AppText> : null}
      </View>
      {children}
    </Card>
  );
}
