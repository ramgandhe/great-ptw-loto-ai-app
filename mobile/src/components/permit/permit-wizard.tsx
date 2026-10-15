import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import { ActionBar, AppText, Banner, Button, Card, ChoiceGroup, DateTimeField, EmptyState, InfoList, PageHeader, Screen, TextField, ToggleRow } from "@/components/ui";
import { CalendarClock, ChevronRight, Paperclip, Pencil, Plus, Save, Send } from "@/components/ui/icons";
import { formatWindow } from "@/lib/format";
import { hazardFitsPermitType } from "@/lib/master-data/hazard-fit";
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
import { gasDefaults, type GasDefault } from "@/lib/master-data/api";
import { loadAssetDirectory, loadSiteDirectory, loadWorkLocationDirectory } from "@/lib/organisation/offline";
import type { AssetRecord, PlaceSite, WorkLocationRecord } from "@/lib/place/api";
import { formatWorkforceOptionLabel, loadPermitFormOptions } from "@/lib/permit/form-options";
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
  const [assetProcedures, setAssetProcedures] = useState<LototoProcedureListItem[]>([]);
  const [gasOptions, setGasOptions] = useState<GasDefault[]>([]);
  const [sites, setSites] = useState<PlaceSite[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [searchWholeSite, setSearchWholeSite] = useState(false);
  const [gasNotice, setGasNotice] = useState<string | null>(null);
  const [gasLimitError, setGasLimitError] = useState<string | null>(null);
  const [extraGas, setExtraGas] = useState({ parameter: "", unit: "", minimum: "", maximum: "" });

  useEffect(() => {
    loadPermitFormOptions()
      .then((options) => {
        setFormOptions(options);
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
    loadSiteDirectory()
      .then((rows) => {
        setSites(rows);
        setForm((current) => ({
          ...current,
          siteId: current.siteId || (mode === "create" && rows.length === 1 ? rows[0].id : ""),
        }));
      })
      .catch(() => setSites([]));
  }, [mode]);

  useEffect(() => {
    if (!form.siteId) {
      setWorkLocations([]);
      return;
    }
    loadWorkLocationDirectory(form.siteId).then(setWorkLocations).catch(() => setWorkLocations([]));
  }, [form.siteId]);

  useEffect(() => {
    if (!form.siteId || (!form.workLocationId && !searchWholeSite)) {
      setAssets([]);
      return;
    }
    loadAssetDirectory(form.siteId, searchWholeSite ? undefined : form.workLocationId).then(setAssets).catch(() => setAssets([]));
  }, [form.siteId, form.workLocationId, searchWholeSite]);

  const assetKey = form.assetIds.join(",");

  useEffect(() => {
    if (!assetKey) {
      setAssetProcedures([]);
      return;
    }
    Promise.all(assetKey.split(",").map((id) => listLototoProcedures({ assetId: id, published: true }).catch(() => [] as LototoProcedureListItem[])))
      .then((lists) => {
        const byId = new Map<string, LototoProcedureListItem>();
        for (const row of lists.flat()) byId.set(row.id, row);
        setAssetProcedures([...byId.values()]);
      })
      .catch(() => setAssetProcedures([]));
  }, [assetKey]);

  useEffect(() => {
    if (!form.workLocationId) {
      setGasOptions([]);
      return;
    }
    let cancelled = false;
    gasDefaults(form.workLocationId, form.assetIds)
      .then((rows) => {
        if (cancelled) return;
        setGasOptions(rows);
        const tests = rows.map((row) => ({
          gasTestingCatalogueId: row.catalogueId,
          parameter: row.parameter,
          unit: row.unit,
          minimum: row.minimum,
          maximum: row.maximum,
          sourceName: row.minimumSource?.name,
        }));
        if (!form.gasReady && form.gasTesting.length > 0) {
          setGasNotice("Gas tests were recalculated from this place and the selected assets. Tests you added are kept.");
        }
        setForm((current) => {
          if (current.gasReady) return current;
          const handAdded = current.gasTesting.filter((row) => !row.gasTestingCatalogueId && row.parameter?.trim());
          const removedByParameter = new Map(
            current.gasTesting
              .filter((row) => row.gasTestingCatalogueId && row.removedReason?.trim())
              .map((row) => [row.parameter?.trim().toLowerCase() ?? "", row.removedReason]),
          );
          return {
            ...current,
            gasReady: true,
            gasTesting: [
              ...tests.map((row) => ({
                ...row,
                removedReason: removedByParameter.get(row.parameter?.trim().toLowerCase() ?? ""),
              })),
              ...handAdded,
            ],
            gasTestingRequired: tests.length > 0 || handAdded.length > 0,
          };
        });
      })
      .catch(() => {
        if (!cancelled) setForm((current) => (current.gasReady ? current : { ...current, gasReady: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [form.workLocationId, assetKey, form.assetIds]);

  const permitStatus = initialDetail?.permit.status ?? "draft";
  const isReadOnly = !isEditablePermitStatus(permitStatus);

  const forms = useMemo(() => applicableTemplates(formOptions?.templates ?? [], form.permitTypeId), [formOptions?.templates, form.permitTypeId]);
  // What the permit already says, for the check sheets' "fill from permit" fields.
  const prefillSources = useMemo((): Record<TemplatePrefillSource, string | number> => {
    const nameOf = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((row) => row.id === id)?.name ?? "";
    const crew = form.executors
      .map((e) => formOptions?.executors.find((o) => o.id === e.workforceUserId)?.name.replace(/ \(you\)$/, ""))
      .filter((name): name is string => Boolean(name));
    const location = workLocations.find((row) => row.id === form.workLocationId);
    const equipment = assets.filter((row) => form.assetIds.includes(row.id)).map((row) => row.name);
    return {
      department: nameOf(formOptions?.departments, form.departmentId),
      location: location?.pathText || location?.name || "",
      equipment: equipment.join(", "),
      "job-description": [form.title, form.workScope].filter((v) => v.trim()).join("\n\n"),
      "valid-from": form.plannedStartAt.slice(0, 10),
      "valid-to": form.plannedEndAt.slice(0, 10),
      "crew-names": crew.join(", "),
      "crew-count": crew.length || "",
    };
  }, [form, formOptions, workLocations, assets]);
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
    const lists: (readonly { id: string; name: string }[] | undefined)[] = [formOptions?.permitTypes, formOptions?.departments, sites, workLocations, assets];
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
  const needsSafety = form.safetyOfficers.some((row) => row.workforceUserId.trim());
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
    if (stepErrors.length === 0) goTo(step === 4 && !needsSafety ? last : step + 1);
  };

  const nameIn = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((row) => row.id === id)?.name;
  const hazardIds = form.hazards.map((h) => h.hazardCategoryId).filter(Boolean);
  const permitTypeCode = formOptions?.permitTypes.find((type) => type.id === form.permitTypeId)?.code;
  const offeredHazards = (formOptions?.hazards ?? []).filter(
    (hazard) => hazardFitsPermitType(hazard.permitTypeCodes, permitTypeCode) || hazardIds.includes(hazard.id),
  );
  const ppeIds = form.ppe.map((p) => p.ppeCatalogueId).filter(Boolean);
  const notSet = "Not set";
  const crewNames = form.executors.map((e) => nameIn(formOptions?.executors, e.workforceUserId ?? "")).filter(Boolean).join(", ");
  const reviewSections: { step: number; rows: [string, string][] }[] = [
    { step: 0, rows: [["Type", nameIn(formOptions?.permitTypes, form.permitTypeId) ?? notSet], ["Title", form.title || notSet], ["Work", form.workScope || "—"]] },
    {
      step: 1,
      rows: [
        ["Site", nameIn(sites, form.siteId) ?? notSet],
        ["Work location", workLocations.find((row) => row.id === form.workLocationId)?.pathText || nameIn(workLocations, form.workLocationId) || notSet],
        ["Exact spot", form.exactSpot.trim() || "—"],
        ["Assets", assets.filter((row) => form.assetIds.includes(row.id)).map((row) => `${row.tag} — ${row.name}`).join(", ") || "—"],
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
          {step > 0 ? (
            <Button
              label="Back"
              variant="outline"
              onPress={() => goTo(step === last && !needsSafety ? 4 : step - 1)}
              style={{ marginRight: "auto" }}
            />
          ) : null}
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
              onChange={(permitTypeId) => {
                const nextCode = formOptions?.permitTypes.find((type) => type.id === permitTypeId)?.code;
                const kept = form.hazards.filter((row) => {
                  if (!row.hazardCategoryId) return true;
                  const catalogue = formOptions?.hazards.find((hazard) => hazard.id === row.hazardCategoryId);
                  return hazardFitsPermitType(catalogue?.permitTypeCodes, nextCode);
                });
                setForm({ ...form, permitTypeId, hazards: kept });
              }}
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
              label="Site"
              value={form.siteId}
              options={sites.map((item) => ({ value: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))}
              placeholder="Choose site"
              required
              disabled={isReadOnly}
              onChange={(siteId) =>
                setForm({
                  ...form,
                  siteId,
                  workLocationId: "",
                  assetIds: [],
                  gasReady: false,
                  gasTesting: [],
                  gasTestingRequired: false,
                  lototo: [],
                  lototoRequired: false,
                })
              }
            />
            <SelectField
              label="Work location"
              value={form.workLocationId}
              options={workLocations.map((item) => ({ value: item.id, label: item.pathText || item.name }))}
              placeholder={form.siteId ? "Choose work location" : "Choose a site first"}
              required
              disabled={isReadOnly || !form.siteId}
              onChange={(workLocationId) =>
                setForm({
                  ...form,
                  workLocationId,
                  assetIds: [],
                  gasReady: false,
                  gasTesting: [],
                  gasTestingRequired: false,
                  lototo: [],
                  lototoRequired: false,
                })
              }
            />
            <TextField
              label="Exact spot"
              hint="Optional"
              value={form.exactSpot}
              editable={!isReadOnly}
              onChangeText={(exactSpot) => setForm({ ...form, exactSpot })}
              placeholder="For example: north side of the pump skid"
            />
            {form.workLocationId ? (
              <>
              {!isReadOnly ? (
                <Button
                  label={searchWholeSite ? "Showing the whole site" : "Search the whole site"}
                  variant="outline"
                  size="sm"
                  onPress={() => setSearchWholeSite((on) => !on)}
                />
              ) : null}
              {assets.length === 0 ? (
                <AppText variant="caption">{searchWholeSite ? "No assets on this site." : "No assets at this work location or its sub-locations."}</AppText>
              ) : (
                <ChoiceGroup
                  label="Assets"
                  options={assets.map((item) => ({ key: item.id, label: `${item.tag} — ${item.name}` }))}
                  value={form.assetIds}
                  disabled={isReadOnly}
                  onChange={(id) => {
                    const assetIds = form.assetIds.includes(id) ? form.assetIds.filter((row) => row !== id) : [...form.assetIds, id];
                    setForm({
                      ...form,
                      assetIds,
                      gasReady: false,
                      lototo: assetIds.length > 0 ? form.lototo : [],
                      lototoRequired: assetIds.length > 0 ? form.lototoRequired : false,
                    });
                  }}
                />
              )}
              </>
            ) : null}
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
              options={offeredHazards.map((item) => ({ key: item.id, label: item.name }))}
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
              description={form.assetIds.length > 0 ? "Lock out the asset's energy before work starts." : "Choose an asset in the previous step first."}
              value={form.lototoRequired}
              disabled={isReadOnly || form.assetIds.length === 0}
              onChange={(on) => setForm({ ...form, lototoRequired: on, lototo: on ? form.lototo : [] })}
            />
            {form.lototoRequired ? (
              assetProcedures.length === 0 ? (
                <AppText variant="caption">No LOTOTO procedures for the selected assets.</AppText>
              ) : (
                <ChoiceGroup
                  label="Procedures"
                  options={assetProcedures.map((plan) => ({ key: plan.id, label: plan.title }))}
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
              description={form.workLocationId ? "Tests come from this work location and the selected assets. The strictest limit is kept." : "Choose a work location in the previous step first."}
              value={form.gasTestingRequired || gasOptions.length > 0}
              disabled={isReadOnly || !form.workLocationId || gasOptions.length > 0}
              onChange={(on) => setForm({ ...form, gasTestingRequired: on, gasTesting: on ? form.gasTesting : [] })}
            />
            {gasNotice ? <AppText variant="caption">{gasNotice}</AppText> : null}
            {gasLimitError ? <AppText variant="caption">{gasLimitError}</AppText> : null}
            {form.gasTestingRequired || form.gasTesting.length > 0 ? (
              form.gasTesting.length === 0 ? (
                <AppText variant="caption">No gas tests are set for this place.</AppText>
              ) : (
                form.gasTesting.map((row, index) => {
                  const baseline = gasOptions.find((item) => item.catalogueId && item.catalogueId === row.gasTestingCatalogueId);
                  return (
                    <View key={`${row.gasTestingCatalogueId ?? "added"}-${index}`} style={{ gap: tokens.space[2] }}>
                      <AppText variant="body" style={row.removedReason ? { textDecorationLine: "line-through" } : undefined}>
                        {`${row.parameter ?? "Test"} (${row.minimum ?? "—"}–${row.maximum ?? "—"} ${row.unit ?? ""})`}
                      </AppText>
                      {row.sourceName ? <AppText variant="caption">{`From ${row.sourceName}`}</AppText> : null}
                      {row.removedReason ? <AppText variant="caption">{`Removed: ${row.removedReason}`}</AppText> : null}
                      {!isReadOnly && !row.removedReason ? (
                        <>
                          <TextField
                            label="Minimum"
                            value={row.minimum == null ? "" : String(row.minimum)}
                            keyboardType="decimal-pad"
                            onChangeText={(value) => {
                              const next = Number(value);
                              if (value.trim() && !Number.isFinite(next)) return;
                              if (baseline && Number.isFinite(next) && next < baseline.minimum) {
                                setGasLimitError("A limit cannot be loosened.");
                                return;
                              }
                              setGasLimitError(null);
                              setForm({
                                ...form,
                                gasReady: true,
                                gasTesting: form.gasTesting.map((item, i) => (i === index ? { ...item, minimum: value.trim() ? next : undefined } : item)),
                              });
                            }}
                          />
                          <TextField
                            label="Maximum"
                            value={row.maximum == null ? "" : String(row.maximum)}
                            keyboardType="decimal-pad"
                            onChangeText={(value) => {
                              const next = Number(value);
                              if (value.trim() && !Number.isFinite(next)) return;
                              if (baseline && Number.isFinite(next) && next > baseline.maximum) {
                                setGasLimitError("A limit cannot be loosened.");
                                return;
                              }
                              setGasLimitError(null);
                              setForm({
                                ...form,
                                gasReady: true,
                                gasTesting: form.gasTesting.map((item, i) => (i === index ? { ...item, maximum: value.trim() ? next : undefined } : item)),
                              });
                            }}
                          />
                          <TextField
                            label="Reason to remove"
                            value={row.removedReason ?? ""}
                            onChangeText={(removedReason) =>
                              setForm({
                                ...form,
                                gasReady: true,
                                gasTesting: form.gasTesting.map((item, i) => (i === index ? { ...item, removedReason } : item)),
                              })
                            }
                          />
                        </>
                      ) : null}
                      {!isReadOnly && row.removedReason?.trim() ? (
                        <Button
                          label="Restore"
                          variant="outline"
                          size="sm"
                          onPress={() =>
                            setForm({
                              ...form,
                              gasReady: true,
                              gasTesting: form.gasTesting.map((item, i) => (i === index ? { ...item, removedReason: "" } : item)),
                            })
                          }
                        />
                      ) : null}
                    </View>
                  );
                })
              )
            ) : null}
            {!isReadOnly && form.workLocationId ? (
              <View style={{ gap: tokens.space[2] }}>
                <AppText variant="label">Add a test for this permit</AppText>
                <TextField label="Parameter" value={extraGas.parameter} onChangeText={(parameter) => setExtraGas({ ...extraGas, parameter })} />
                <TextField label="Unit" value={extraGas.unit} onChangeText={(unit) => setExtraGas({ ...extraGas, unit })} />
                <TextField label="Minimum" value={extraGas.minimum} keyboardType="decimal-pad" onChangeText={(minimum) => setExtraGas({ ...extraGas, minimum })} />
                <TextField label="Maximum" value={extraGas.maximum} keyboardType="decimal-pad" onChangeText={(maximum) => setExtraGas({ ...extraGas, maximum })} />
                <Button
                  label="Add test"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    const minimum = Number(extraGas.minimum);
                    const maximum = Number(extraGas.maximum);
                    if (!extraGas.parameter.trim() || !extraGas.unit.trim() || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) {
                      setGasLimitError("Enter a parameter, a unit and a range.");
                      return;
                    }
                    setGasLimitError(null);
                    setForm({
                      ...form,
                      gasReady: true,
                      gasTestingRequired: true,
                      gasTesting: [...form.gasTesting, { parameter: extraGas.parameter.trim(), unit: extraGas.unit.trim(), minimum, maximum }],
                    });
                    setExtraGas({ parameter: "", unit: "", minimum: "", maximum: "" });
                  }}
                />
              </View>
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

      {step === 5 ? (
        needsSafety ? (
          <EmptyState
            title="Safety Approval"
            body="An assigned safety officer comments and types their name on the web. One sign-off is enough."
          />
        ) : (
          <EmptyState title="Safety Approval is not needed" body="No safety officer is assigned on this permit." done />
        )
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
  "Assigned safety officers sign here. Skip this step if none are assigned.",
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
