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
import { createPermit, savePermitDraft, submitPermit, uploadPermitAttachment } from "@/lib/permit/api";
import {
  createEmptyPermitForm,
  formToSavePayload,
  PERMIT_WIZARD_STEPS,
  permitDetailToForm,
  validateStep,
} from "@/lib/permit/form";
import {
  isOfflineError,
  queuePermitMutation,
  saveLocalPermitDraft,
} from "@/lib/permit/offline";
import type { PermitDetail, PermitFormState } from "@/lib/permit/types";
import { isEditablePermitStatus } from "@/lib/permit/status";
import * as DocumentPicker from "expo-document-picker";
import { SelectField } from "@/components/ui/select-field";
import {
  filterMachineryByWorkstation,
  formatOrgOptionLabel,
  formatWorkforceOptionLabel,
  loadPermitFormOptions,
} from "@/lib/permit/form-options";

type PermitWizardProps = {
  mode: "create" | "edit";
  permitId?: string;
  initialDetail?: PermitDetail;
  initialForm?: PermitFormState;
};

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#d1d5db",
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
} as const;

export function PermitWizard({ mode, permitId, initialDetail, initialForm }: PermitWizardProps) {
  const [form, setForm] = useState<PermitFormState>(
    initialForm ?? (initialDetail ? permitDetailToForm(initialDetail) : createEmptyPermitForm()),
  );
  const [currentPermitId, setCurrentPermitId] = useState<string | undefined>(permitId);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [attachments, setAttachments] = useState(initialDetail?.attachments ?? []);
  const [formOptions, setFormOptions] = useState<Awaited<ReturnType<typeof loadPermitFormOptions>> | null>(
    null,
  );
  const [optionsLoading, setOptionsLoading] = useState(true);

  const filteredMachinery = useMemo(
    () => filterMachineryByWorkstation(formOptions?.machinery ?? [], form.workstationId),
    [formOptions?.machinery, form.workstationId],
  );

  useEffect(() => {
    loadPermitFormOptions()
      .then((options) => {
        setFormOptions(options);
        setForm((current) => {
          if (current.executors.some((executor) => executor.workforceUserId.trim())) {
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
      setForm((current) => ({ ...current, machineryId: "" }));
    }
  }, [filteredMachinery, form.machineryId]);

  const permitStatus = initialDetail?.permit.status ?? "draft";
  const isReadOnly = !isEditablePermitStatus(permitStatus);

  const persistDraft = useCallback(async () => {
    const payload = formToSavePayload(form);

    try {
      if (!currentPermitId) {
        const created = await createPermit({
          permitTypeId: payload.permitTypeId!,
          title: payload.title!,
          workScope: payload.workScope,
          currentStep: form.currentStep,
        });
        setCurrentPermitId(created.permit.id);
        await savePermitDraft(created.permit.id, payload);
        setQueuedOffline(false);
        return created.permit.id;
      }

      await savePermitDraft(currentPermitId, payload);
      setQueuedOffline(false);
      return currentPermitId;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }

      const localId = currentPermitId ?? createLocalId();
      await saveLocalPermitDraft(localId, payload.title ?? "Untitled permit", payload);

      if (!currentPermitId) {
        await queuePermitMutation({
          method: "POST",
          path: "/permits",
          payload,
          localDraftId: localId,
          title: payload.title,
        });
      } else {
        await queuePermitMutation({
          method: "PATCH",
          path: `/permits/${currentPermitId}`,
          payload,
          localDraftId: localId,
          title: payload.title,
        });
      }

      setCurrentPermitId(localId);
      setQueuedOffline(true);
      return localId;
    }
  }, [currentPermitId, form]);

  const handleSaveDraft = async () => {
    setIsBusy(true);
    setMessage(null);
    try {
      await persistDraft();
      setMessage(queuedOffline ? "Draft saved offline and queued for sync" : "Draft saved");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Failed to save draft");
    } finally {
      setIsBusy(false);
    }
  };

  const handleNext = async () => {
    const stepErrors = validateStep(form, form.currentStep);
    setErrors(stepErrors);
    if (stepErrors.length > 0) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      await persistDraft();
      setForm((current) => ({
        ...current,
        currentStep: Math.min(current.currentStep + 1, PERMIT_WIZARD_STEPS.length - 1),
      }));
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Failed to save progress");
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
    const allErrors = PERMIT_WIZARD_STEPS.flatMap((_, index) => validateStep(form, index));
    setErrors(allErrors);
    if (allErrors.length > 0) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const id = (await persistDraft())!;
      if (queuedOffline) {
        await queuePermitMutation({
          method: "POST_SUBMIT",
          path: `/permits/${id}/submit`,
          localDraftId: id,
          title: form.title,
        });
        setMessage("Permit queued for submission when online");
        router.replace("/permits");
        return;
      }

      await submitPermit(id);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{mode === "create" ? "Create permit" : "Edit draft"}</Text>
      <Text style={styles.subtitle}>{PERMIT_WIZARD_STEPS[step]}</Text>

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

      {step === 0 ? (
        <View style={styles.section}>
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
      ) : null}

      {step === 1 ? (
        <View style={styles.section}>
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
            onChange={(workstationId) => setForm({ ...form, workstationId })}
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
            onChange={(machineryId) => setForm({ ...form, machineryId })}
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
      ) : null}

      {step === 2 ? (
        <View style={styles.section}>
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
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.section}>
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
      ) : null}

      {step === 4 ? (
        <View style={styles.section}>
          <Text style={styles.summaryTitle}>{form.title}</Text>
          <Text style={styles.summaryLine}>Type: {form.permitTypeId || "—"}</Text>
          <Text style={styles.summaryLine}>Location: {form.locationId || "—"}</Text>
          <Text style={styles.summaryLine}>
            Hazards: {form.hazards.filter((h) => h.hazardCategoryId.trim()).length}
          </Text>
          <Text style={styles.summaryLine}>
            Executors: {form.executors.filter((e) => e.workforceUserId.trim()).length}
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
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setForm({ ...form, currentStep: step - 1 })}
            disabled={isBusy}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryButton} onPress={() => void handleSaveDraft()} disabled={isBusy}>
          {isBusy ? <ActivityIndicator /> : <Text style={styles.secondaryButtonText}>Save draft</Text>}
        </Pressable>
        {step < PERMIT_WIZARD_STEPS.length - 1 ? (
          <Pressable style={styles.primaryButton} onPress={() => void handleNext()} disabled={isBusy}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryButton} onPress={() => void handleSubmit()} disabled={isBusy}>
            <Text style={styles.primaryButtonText}>Submit</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "600" },
  subtitle: { fontSize: 14, color: "#666" },
  banner: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
  },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  label: { fontSize: 13, fontWeight: "500" },
  card: { gap: 8, padding: 10, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  errorBox: { backgroundColor: "#fee2e2", padding: 10, borderRadius: 8, gap: 4 },
  errorText: { color: "#b91c1c", fontSize: 13 },
  message: { color: "#2563eb", fontSize: 13 },
  summaryTitle: { fontSize: 18, fontWeight: "600" },
  summaryLine: { fontSize: 14, color: "#444" },
  hint: { fontSize: 12, color: "#666" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  primaryButton: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: { color: "#111827", fontWeight: "500" },
});
