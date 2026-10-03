import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { createPermit, getPermit, isRevisionConflict, savePermitDraft, submitPermit, uploadPermitAttachment } from "@/lib/permit/api";
import {
  createEmptyPermitForm,
  formToSavePayload,
  PERMIT_WIZARD_STEPS,
  permitDetailToForm,
  shouldSaveExecutorPayload,
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
import { applicableTemplates, missingFormAnswers, withPrefill } from "@/lib/permit/forms";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { listGasTesting, type GasTestingRecord } from "@/lib/master-data/api";
import {
  filterMachineryByWorkstation,
  formatOrgOptionLabel,
  formatWorkforceOptionLabel,
  loadPermitFormOptions,
} from "@/lib/permit/form-options";
import { mergeAfterConflict, resolveConflict, type FieldConflict } from "@/lib/permit/conflict";
import { useThemedStyles } from "@/theme/use-themed-styles";
import type { ThemeColors } from "@/theme/types";
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

const inputBase = {
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
} as const;

export function PermitWizard({ mode, permitId, initialDetail, initialForm }: PermitWizardProps) {
  const inputStyle = { ...inputBase, borderColor: useTheme().tokens.colors.border, color: useTheme().tokens.colors.foreground };
  const styles = useThemedStyles(createStyles);
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
  const [machineryLototo, setMachineryLototo] = useState<LototoPlan[]>([]);
  const [workstationGasTesting, setWorkstationGasTesting] = useState<GasTestingRecord[]>([]);

  const filteredMachinery = useMemo(
    () => filterMachineryByWorkstation(formOptions?.machinery ?? [], form.workstationId),
    [formOptions?.machinery, form.workstationId],
  );

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
    listLototoPlans({ machineryId: form.machineryId })
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
  // Prefilled answers follow the permit until someone edits them, and are saved with it.
  const prefilled = useMemo(() => {
    const nameOf = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((row) => row.id === id)?.name ?? "";
    const crew = form.executors
      .map((e) => formOptions?.executors.find((o) => o.id === e.workforceUserId)?.name.replace(/ \(you\)$/, ""))
      .filter((name): name is string => Boolean(name));
    const place = [...new Set([nameOf(formOptions?.locations, form.locationId), nameOf(formOptions?.workstations, form.workstationId)].filter(Boolean))];
    return {
      ...form,
      formResponses: withPrefill(form.formResponses, forms, {
        department: nameOf(formOptions?.departments, form.departmentId),
        location: place.join(", "),
        equipment: nameOf(formOptions?.machinery, form.machineryId),
        "job-description": [form.title, form.workScope].filter((v) => v.trim()).join("\n\n"),
        "valid-from": form.plannedStartAt.slice(0, 10),
        "valid-to": form.plannedEndAt.slice(0, 10),
        "crew-names": crew.join(", "),
        "crew-count": crew.length || "",
      }),
    };
  }, [form, forms, formOptions]);

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
    const lists = [formOptions?.permitTypes, formOptions?.plants, formOptions?.departments, formOptions?.locations, formOptions?.workstations, formOptions?.machinery];
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{mode === "create" ? "Create permit" : "Edit draft"}</Text>
      <Text style={styles.subtitle}>All sections on one page. Save at any point; submit when everything is filled in.</Text>

      {queuedOffline ? (
        <Text style={styles.banner}>Offline mode — changes will sync when connected.</Text>
      ) : null}

      {errors.length > 0 ? (
        <View style={styles.errorBox}>
          {errors.map((error) => (
            <Text key={error} style={styles.errorText}>
              • {error}
            </Text>
          ))}
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {conflicts.map((item) => (
        <View key={item.key} style={styles.card}>
          <Text style={styles.label}>{conflictLabel(item.key)}</Text>
          <Text style={styles.summaryLine}>{`Saved: ${describeValue(item.saved)}`}</Text>
          <Text style={styles.summaryLine}>{`Yours: ${describeValue(item.yours)}`}</Text>
          <View style={styles.actions}>
            {(["yours", "saved"] as const).map((keep) => (
              <Pressable
                key={keep}
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => {
                  setForm((current) => resolveConflict(current, item, keep));
                  setConflicts((current) => current.filter((c) => c.key !== item.key));
                }}
              >
                <Text style={styles.secondaryButtonText}>{keep === "yours" ? "Keep mine" : "Use saved"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Work */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader} accessibilityRole="header">Work</Text>
          <SelectField
            label="Permit type"
            value={form.permitTypeId}
            options={(formOptions?.permitTypes ?? []).map((item) => ({
              value: item.id,
              label: formatOrgOptionLabel(item),
            }))}
            placeholder="Select permit type"
            required
            disabled={isReadOnly || optionsLoading}
            onChange={(permitTypeId) => setForm({ ...form, permitTypeId })}
          />
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={inputStyle}
            value={form.title}
            onChangeText={(value) => setForm({ ...form, title: value })}
          />
          <Text style={styles.label}>Work scope</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            multiline
            value={form.workScope}
            onChangeText={(value) => setForm({ ...form, workScope: value })}
          />
        </View>

      {/* Place and schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader} accessibilityRole="header">Place and schedule</Text>
          <SelectField
            label="Plant"
            value={form.plantId}
            options={(formOptions?.plants ?? []).map((item) => ({
              value: item.id,
              label: formatOrgOptionLabel(item),
            }))}
            placeholder="Select plant"
            disabled={isReadOnly || optionsLoading}
            onChange={(plantId) => setForm({ ...form, plantId })}
          />
          <SelectField
            label="Department"
            value={form.departmentId}
            options={(formOptions?.departments ?? []).map((item) => ({
              value: item.id,
              label: formatOrgOptionLabel(item),
            }))}
            placeholder="Select department"
            disabled={isReadOnly || optionsLoading}
            onChange={(departmentId) => setForm({ ...form, departmentId })}
          />
          <SelectField
            label="Location"
            value={form.locationId}
            options={(formOptions?.locations ?? []).map((item) => ({
              value: item.id,
              label: formatOrgOptionLabel(item),
            }))}
            placeholder="Select location"
            disabled={isReadOnly || optionsLoading}
            onChange={(locationId) => setForm({ ...form, locationId })}
          />
          <SelectField
            label="Workstation"
            value={form.workstationId}
            options={(formOptions?.workstations ?? []).map((item) => ({
              value: item.id,
              label: formatOrgOptionLabel(item),
            }))}
            placeholder="Select workstation (optional)"
            disabled={isReadOnly || optionsLoading}
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
            options={filteredMachinery.map((item) => ({
              value: item.id,
              label: formatOrgOptionLabel(item),
            }))}
            placeholder="Select machinery (optional)"
            disabled={isReadOnly || optionsLoading}
            onChange={(machineryId) =>
              setForm({
                ...form,
                machineryId,
                lototo: machineryId === form.machineryId ? form.lototo : [],
                lototoRequired: machineryId ? form.lototoRequired : false,
              })
            }
          />
          <Text style={styles.label}>Planned start (ISO datetime)</Text>
          <TextInput
            style={inputStyle}
            value={form.plannedStartAt}
            onChangeText={(value) => setForm({ ...form, plannedStartAt: value })}
            placeholder="2026-07-28T09:00"
          />
          <Text style={styles.label}>Planned end (ISO datetime)</Text>
          <TextInput
            style={inputStyle}
            value={form.plannedEndAt}
            onChangeText={(value) => setForm({ ...form, plannedEndAt: value })}
            placeholder="2026-07-28T17:00"
          />
        </View>

      {/* Site safety */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader} accessibilityRole="header">Site safety</Text>
          <Text style={styles.sectionTitle}>Hazards</Text>
          {form.hazards.map((hazard, index) => (
            <View key={`hazard-${index}`} style={styles.card}>
              <SelectField
                label="Hazard category"
                value={hazard.hazardCategoryId}
                options={(formOptions?.hazards ?? []).map((item) => ({
                  value: item.id,
                  label: formatOrgOptionLabel(item),
                }))}
                placeholder="Select hazard"
                disabled={isReadOnly || optionsLoading}
                onChange={(hazardCategoryId) => {
                  const hazards = [...form.hazards];
                  hazards[index] = { ...hazard, hazardCategoryId };
                  setForm({ ...form, hazards });
                }}
              />
              <TextInput
                style={[inputStyle, styles.textArea]}
                placeholder="Description"
                multiline
                value={hazard.description}
                onChangeText={(value) => {
                  const hazards = [...form.hazards];
                  hazards[index] = { ...hazard, description: value };
                  setForm({ ...form, hazards });
                }}
              />
            </View>
          ))}
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              setForm({
                ...form,
                hazards: [...form.hazards, { hazardCategoryId: "", description: "" }],
              })
            }
          >
            <Text style={styles.secondaryButtonText}>Add hazard</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>PPE</Text>
          {form.ppe.map((item, index) => (
            <View key={`ppe-${index}`} style={styles.card}>
              <SelectField
                label="PPE item"
                value={item.ppeCatalogueId}
                options={(formOptions?.ppe ?? []).map((ppeItem) => ({
                  value: ppeItem.id,
                  label: formatOrgOptionLabel(ppeItem),
                }))}
                placeholder="Select PPE"
                disabled={isReadOnly || optionsLoading}
                onChange={(ppeCatalogueId) => {
                  const ppe = [...form.ppe];
                  ppe[index] = { ...item, ppeCatalogueId };
                  setForm({ ...form, ppe });
                }}
              />
            </View>
          ))}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setForm({ ...form, ppe: [...form.ppe, { ppeCatalogueId: "", quantity: 1 }] })}
          >
            <Text style={styles.secondaryButtonText}>Add PPE</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            disabled={isReadOnly || !form.machineryId}
            onPress={() =>
              setForm({
                ...form,
                lototoRequired: !form.lototoRequired,
                lototo: !form.lototoRequired ? form.lototo : [],
              })
            }
          >
            <Text style={styles.secondaryButtonText}>
              {form.lototoRequired ? "LOTOTO required (on)" : "LOTOTO required (off)"}
            </Text>
          </Pressable>

          {form.lototoRequired ? (
            <>
              {machineryLototo.length === 0 ? (
                <Text style={styles.hint}>No LOTOTO procedures for this machinery.</Text>
              ) : null}
              {form.lototo.map((item, index) => (
                <SelectField
                  key={`lototo-${index}`}
                  label="LOTOTO procedure"
                  value={item.lototoPlanId}
                  options={machineryLototo.map((plan) => ({
                    value: plan.id,
                    label: plan.title,
                  }))}
                  placeholder="Select LOTOTO"
                  disabled={isReadOnly}
                  onChange={(lototoPlanId) => {
                    const lototo = [...form.lototo];
                    lototo[index] = { lototoPlanId };
                    setForm({ ...form, lototo });
                  }}
                />
              ))}
              <Pressable
                style={styles.secondaryButton}
                disabled={isReadOnly || machineryLototo.length === 0}
                onPress={() =>
                  setForm({ ...form, lototo: [...form.lototo, { lototoPlanId: "" }] })
                }
              >
                <Text style={styles.secondaryButtonText}>Add LOTOTO</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            style={styles.secondaryButton}
            disabled={isReadOnly || !form.workstationId}
            onPress={() =>
              setForm({
                ...form,
                gasTestingRequired: !form.gasTestingRequired,
                gasTesting: !form.gasTestingRequired ? form.gasTesting : [],
              })
            }
          >
            <Text style={styles.secondaryButtonText}>
              {form.gasTestingRequired ? "Gas testing required (on)" : "Gas testing required (off)"}
            </Text>
          </Pressable>

          {form.gasTestingRequired ? (
            <>
              {workstationGasTesting.length === 0 ? (
                <Text style={styles.hint}>No gas testing items for this workstation.</Text>
              ) : null}
              {form.gasTesting.map((item, index) => (
                <SelectField
                  key={`gas-testing-${index}`}
                  label="Gas testing item"
                  value={item.gasTestingCatalogueId}
                  options={workstationGasTesting.map((row) => ({
                    value: row.id,
                    label: `${row.parameter} (${row.minimum}–${row.maximum} ${row.unit})`,
                  }))}
                  placeholder="Select gas testing"
                  disabled={isReadOnly}
                  onChange={(gasTestingCatalogueId) => {
                    const gasTesting = [...form.gasTesting];
                    gasTesting[index] = { gasTestingCatalogueId };
                    setForm({ ...form, gasTesting });
                  }}
                />
              ))}
              <Pressable
                style={styles.secondaryButton}
                disabled={isReadOnly || workstationGasTesting.length === 0}
                onPress={() =>
                  setForm({
                    ...form,
                    gasTesting: [...form.gasTesting, { gasTestingCatalogueId: "" }],
                  })
                }
              >
                <Text style={styles.secondaryButtonText}>Add gas testing</Text>
              </Pressable>
            </>
          ) : null}
        </View>

      {/* Crew */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader} accessibilityRole="header">Crew</Text>
          {form.executors.map((executor, index) => (
            <View key={`executor-${index}`} style={styles.card}>
              <SelectField
                label="Executor"
                value={executor.workforceUserId}
                options={(formOptions?.executors ?? []).map((person) => ({
                  value: person.id,
                  label: formatWorkforceOptionLabel(person),
                }))}
                placeholder="Select executor"
                disabled={isReadOnly || optionsLoading}
                onChange={(workforceUserId) => {
                  const executors = [...form.executors];
                  executors[index] = { ...executor, workforceUserId };
                  setForm({ ...form, executors });
                }}
              />
            </View>
          ))}
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              setForm({
                ...form,
                executors: [...form.executors, { workforceUserId: "", isPrimary: false }],
              })
            }
          >
            <Text style={styles.secondaryButtonText}>Add executor</Text>
          </Pressable>
        </View>

      {/* Forms and check sheets */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader} accessibilityRole="header">Forms and check sheets</Text>
          {forms.length === 0 ? (
            <Text style={styles.hint}>No forms or check sheets apply to this permit type.</Text>
          ) : (
            forms.map((template) => (
              <TemplateFormFill
                key={template.id}
                name={template.name}
                config={template.config!}
                answers={prefilled.formResponses[template.id] ?? {}}
                disabled={isReadOnly}
                signerName={formOptions?.userName ?? ""}
                onChange={(answers) => setForm({ ...form, formResponses: { ...form.formResponses, [template.id]: answers } })}
              />
            ))
          )}
        </View>

      {/* Review */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader} accessibilityRole="header">Review</Text>
          <Text style={styles.summaryTitle}>{form.title}</Text>
          <Text style={styles.summaryLine}>Type: {formOptions?.permitTypes.find((t) => t.id === form.permitTypeId)?.name ?? "—"}</Text>
          <Text style={styles.summaryLine}>Location: {formOptions?.locations.find((l) => l.id === form.locationId)?.name ?? "—"}</Text>
          <Text style={styles.summaryLine}>
            Hazards: {form.hazards.filter((h) => h.hazardCategoryId.trim()).length}
          </Text>
          <Text style={styles.summaryLine}>
            Executors: {form.executors.filter((e) => (e.workforceUserId ?? "").trim()).length}
          </Text>
          <Text style={styles.sectionTitle}>Attachments</Text>
          {attachments.length === 0 ? (
            <Text style={styles.hint}>No attachments uploaded yet.</Text>
          ) : (
            attachments.map((attachment) => (
              <Text key={attachment.id} style={styles.summaryLine}>
                {attachment.fileName}
              </Text>
            ))
          )}
          {!isReadOnly && currentPermitId ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void handlePickAttachment()}
              disabled={isBusy}
            >
              <Text style={styles.secondaryButtonText}>Add attachment</Text>
            </Pressable>
          ) : null}
        </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => void handleSaveDraft()} disabled={isBusy}>
          {isBusy ? <ActivityIndicator /> : <Text style={styles.secondaryButtonText}>Save draft</Text>}
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => void handleSubmit()} disabled={isBusy}>
          <Text style={styles.primaryButtonText}>Submit</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "600", color: c.foreground },
  subtitle: { fontSize: 14, color: c.mutedForeground },
  sectionHeader: { fontSize: 18, fontWeight: "700", marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, color: c.foreground },
  banner: {
    backgroundColor: c.warningBg,
    color: c.warning,
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
  },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 8, color: c.foreground },
  label: { fontSize: 13, fontWeight: "500", color: c.foreground },
  card: { gap: 8, padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  errorBox: { backgroundColor: c.dangerBg, padding: 10, borderRadius: 8, gap: 4 },
  errorText: { color: c.danger, fontSize: 13 },
  message: { color: c.primary, fontSize: 13 },
  summaryTitle: { fontSize: 18, fontWeight: "600", color: c.foreground },
  summaryLine: { fontSize: 14, color: c.mutedForeground },
  hint: { fontSize: 12, color: c.mutedForeground },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  primaryButton: {
    backgroundColor: c.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: { color: c.primaryForeground, fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: { color: c.foreground, fontWeight: "500" },
});
