"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getProfile } from "@/lib/auth/api";
import { masterDataApi, type MasterDataRecord } from "@/lib/master-data/api";
import { departmentsApi, locationsApi, machineryApi, plantsApi, workstationsApi } from "@/lib/organisation/api";
import type { MachineryRecord } from "@/lib/organisation/types";
import {
  createPermit,
  removePermitAttachment,
  savePermitDraft,
  submitPermit,
  uploadPermitAttachment,
} from "@/lib/permit/api";
import {
  createEmptyPermitForm,
  formToSavePayload,
  PERMIT_WIZARD_STEPS,
  permitDetailToForm,
  validateStep,
} from "@/lib/permit/form";
import type { PermitAttachment, PermitDetail, PermitFormState } from "@/lib/permit/types";
import { isEditablePermitStatus } from "@/lib/permit/status";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { ensureEndAfterStart } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { DraftBanner } from "./draft-banner";
import { fieldClassName, FormField } from "./form-field";
import { MasterDataSelect } from "./master-data-select";
import { formatWorkforceOptionLabel } from "@/components/lototo/select-field";
import { PlannedDateTimeField } from "./planned-datetime-field";
import { PermitStepNav } from "./permit-step-nav";
import { PermitSummary } from "./permit-summary";
import { ValidationSummary } from "./validation-summary";

type PermitWizardProps = {
  mode: "create" | "edit";
  initialDetail?: PermitDetail;
};

export function PermitWizard({ mode, initialDetail }: PermitWizardProps) {
  const router = useRouter();
  const [permitId, setPermitId] = useState<string | undefined>(initialDetail?.permit.id);
  const [form, setForm] = useState<PermitFormState>(
    initialDetail ? permitDetailToForm(initialDetail) : createEmptyPermitForm(),
  );
  const [attachments, setAttachments] = useState<PermitAttachment[]>(
    initialDetail?.attachments ?? [],
  );
  const [reference, setReference] = useState<string | null>(initialDetail?.permit.reference ?? null);
  const [status, setStatus] = useState(initialDetail?.permit.status ?? "draft");
  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [permitTypes, setPermitTypes] = useState<MasterDataRecord[]>([]);
  const [plants, setPlants] = useState<MasterDataRecord[]>([]);
  const [departments, setDepartments] = useState<MasterDataRecord[]>([]);
  const [locations, setLocations] = useState<MasterDataRecord[]>([]);
  const [workstations, setWorkstations] = useState<MasterDataRecord[]>([]);
  const [machinery, setMachinery] = useState<MachineryRecord[]>([]);
  const [hazards, setHazards] = useState<MasterDataRecord[]>([]);
  const [ppeItems, setPpeItems] = useState<MasterDataRecord[]>([]);
  const [executorOptions, setExecutorOptions] = useState<WorkforceRecord[]>([]);
  const [masterDataLoading, setMasterDataLoading] = useState(true);

  useEffect(() => {
    setMasterDataLoading(true);
    Promise.all([
      masterDataApi.permitTypes(),
      plantsApi.list(),
      departmentsApi.list(),
      locationsApi.list(),
      workstationsApi.list(),
      machineryApi.list(),
      masterDataApi.hazards(),
      masterDataApi.ppe(),
      listWorkforceDirectory().catch(() => [] as WorkforceRecord[]),
      getProfile(),
    ])
      .then(([permitTypeRows, plantRows, departmentRows, locationRows, workstationRows, machineryRows, hazardRows, ppeRows, workforceRows, profile]) => {
        setPermitTypes(permitTypeRows);
        setPlants(plantRows);
        setDepartments(departmentRows);
        setLocations(locationRows);
        setWorkstations(workstationRows);
        setMachinery(machineryRows);
        setHazards(hazardRows);
        setPpeItems(ppeRows);

        const displayName =
          [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username;
        const byId = new Map<string, WorkforceRecord>();
        byId.set(profile.id, {
          id: profile.id,
          name: `${displayName} (you)`,
          email: profile.email ?? null,
          role: profile.roles[0] ?? "signed-in user",
        });
        for (const person of workforceRows) {
          byId.set(person.id, person);
        }
        setExecutorOptions(Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)));

        setForm((current) => {
          if (current.executors.some((executor) => executor.workforceUserId.trim())) {
            return current;
          }
          return {
            ...current,
            executors: [{ workforceUserId: profile.id, isPrimary: true }],
          };
        });
      })
      .catch((error) => {
        setApiError(error instanceof ApiError ? error.message : "Failed to load master data");
      })
      .finally(() => setMasterDataLoading(false));
  }, []);

  useEffect(() => {
    if (initialDetail) {
      setForm(permitDetailToForm(initialDetail));
      setAttachments(initialDetail.attachments);
      setReference(initialDetail.permit.reference);
      setStatus(initialDetail.permit.status);
      setPermitId(initialDetail.permit.id);
    }
  }, [initialDetail]);

  const persistDraft = useCallback(async () => {
    const payload = formToSavePayload(form);

    if (!permitId) {
      const created = await createPermit({
        permitTypeId: payload.permitTypeId!,
        title: payload.title!,
        workScope: payload.workScope,
        currentStep: form.currentStep,
      });
      setPermitId(created.permit.id);
      setStatus(created.permit.status);
      router.replace(`/permits/${created.permit.id}/edit`);
      return created.permit.id;
    }

    await savePermitDraft(permitId, payload);
    return permitId;
  }, [form, permitId, router]);

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setApiError(null);
    try {
      await persistDraft();
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    const stepErrors = validateStep(form, form.currentStep);
    setErrors(stepErrors);
    if (stepErrors.length > 0) {
      return;
    }

    setIsSaving(true);
    setApiError(null);
    try {
      await persistDraft();
      setForm((current) => ({
        ...current,
        currentStep: Math.min(current.currentStep + 1, PERMIT_WIZARD_STEPS.length - 1),
      }));
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "Failed to save progress");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    setErrors([]);
    setForm((current) => ({
      ...current,
      currentStep: Math.max(current.currentStep - 1, 0),
    }));
  };

  const handleSubmit = async () => {
    const allErrors = PERMIT_WIZARD_STEPS.flatMap((_, index) => validateStep(form, index));
    setErrors(allErrors);
    if (allErrors.length > 0) {
      return;
    }

    setIsSubmitting(true);
    setApiError(null);
    try {
      const id = permitId ?? (await persistDraft());
      if (!id) {
        throw new Error("Permit ID missing");
      }
      const result = await submitPermit(id);
      setReference(result.permit.reference);
      setStatus(result.permit.status);
      router.push(`/permits/${id}`);
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        setErrors(error.details as string[]);
      }
      setApiError(error instanceof ApiError ? error.message : "Failed to submit permit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!permitId) {
      setApiError("Save the draft before uploading attachments");
      return;
    }

    setApiError(null);
    try {
      const uploaded = await uploadPermitAttachment(permitId, file);
      setAttachments((current) => [...current, uploaded]);
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "Failed to upload attachment");
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!permitId) {
      return;
    }

    await removePermitAttachment(permitId, attachmentId);
    setAttachments((current) => current.filter((item) => item.id !== attachmentId));
  };

  const isReadOnly = !isEditablePermitStatus(status);
  const isResubmit = status === "deferred" || status === "rejected";
  const step = form.currentStep;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {mode === "create"
            ? "Create permit"
            : isResubmit
              ? "Revise & resubmit permit"
              : "Edit draft permit"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete each step to prepare the permit for submission.
        </p>
      </div>

      {status === "draft" ? <DraftBanner /> : null}
      <PermitStepNav
        currentStep={step}
        onStepClick={(nextStep) => setForm((current) => ({ ...current, currentStep: nextStep }))}
      />
      <ValidationSummary errors={errors} />
      {apiError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {apiError}
        </div>
      ) : null}

      {step === 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Permit type"
            htmlFor="permitTypeId"
            hint={
              masterDataLoading
                ? "Loading permit types…"
                : permitTypes.length === 0
                  ? "No permit types found. Run npm run db:seed or create one in Organisation."
                  : undefined
            }
          >
            <MasterDataSelect
              id="permitTypeId"
              value={form.permitTypeId}
              options={permitTypes}
              disabled={isReadOnly || masterDataLoading}
              placeholder="Select permit type"
              onChange={(permitTypeId) => setForm({ ...form, permitTypeId })}
            />
          </FormField>
          <FormField label="Title" htmlFor="title">
            <input
              id="title"
              className={fieldClassName}
              value={form.title}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </FormField>
          <FormField label="Work scope" htmlFor="workScope" className="md:col-span-2">
            <textarea
              id="workScope"
              className={`${fieldClassName} min-h-28 py-2`}
              value={form.workScope}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, workScope: e.target.value })}
            />
          </FormField>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-4 md:grid-cols-2">
          <FormField label="Plant" htmlFor="plantId">
            <MasterDataSelect
              id="plantId"
              value={form.plantId}
              options={plants}
              disabled={isReadOnly || masterDataLoading}
              placeholder="Select plant"
              onChange={(plantId) => setForm({ ...form, plantId })}
            />
          </FormField>
          <FormField label="Department" htmlFor="departmentId">
            <MasterDataSelect
              id="departmentId"
              value={form.departmentId}
              options={departments}
              disabled={isReadOnly || masterDataLoading}
              placeholder="Select department"
              onChange={(departmentId) => setForm({ ...form, departmentId })}
            />
          </FormField>
          <FormField label="Location" htmlFor="locationId">
            <MasterDataSelect
              id="locationId"
              value={form.locationId}
              options={locations}
              disabled={isReadOnly || masterDataLoading}
              placeholder="Select location"
              onChange={(locationId) => setForm({ ...form, locationId })}
            />
          </FormField>
          <FormField label="Workstation" htmlFor="workstationId">
            <MasterDataSelect
              id="workstationId"
              value={form.workstationId}
              options={workstations}
              disabled={isReadOnly || masterDataLoading}
              placeholder="Select workstation (optional)"
              onChange={(workstationId) =>
                setForm((current) => ({
                  ...current,
                  workstationId,
                  machineryId:
                    current.machineryId &&
                    machinery.some(
                      (item) =>
                        item.id === current.machineryId && item.workstationId !== workstationId,
                    )
                      ? ""
                      : current.machineryId,
                }))
              }
            />
          </FormField>
          <FormField label="Machinery" htmlFor="machineryId">
            <MasterDataSelect
              id="machineryId"
              value={form.machineryId}
              options={
                form.workstationId
                  ? machinery.filter((item) => item.workstationId === form.workstationId)
                  : machinery
              }
              disabled={isReadOnly || masterDataLoading}
              placeholder="Select machinery (optional)"
              onChange={(machineryId) => setForm({ ...form, machineryId })}
            />
          </FormField>
          <FormField label="Planned start" htmlFor="plannedStartAt">
            <PlannedDateTimeField
              id="plannedStartAt"
              value={form.plannedStartAt}
              disabled={isReadOnly}
              onChange={(plannedStartAt) => {
                setForm((current) => ({
                  ...current,
                  plannedStartAt,
                  plannedEndAt: current.plannedEndAt
                    ? ensureEndAfterStart(plannedStartAt, current.plannedEndAt)
                    : current.plannedEndAt,
                }));
              }}
            />
          </FormField>
          <FormField
            label="Planned end"
            htmlFor="plannedEndAt"
            hint={form.plannedStartAt ? "Must be after planned start" : undefined}
          >
            <PlannedDateTimeField
              id="plannedEndAt"
              value={form.plannedEndAt}
              minValue={form.plannedStartAt || undefined}
              disabled={isReadOnly || !form.plannedStartAt}
              onChange={(plannedEndAt) => setForm({ ...form, plannedEndAt })}
            />
          </FormField>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-6">
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Hazards</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isReadOnly}
                onClick={() =>
                  setForm({
                    ...form,
                    hazards: [...form.hazards, { hazardCategoryId: "", description: "" }],
                  })
                }
              >
                Add hazard
              </Button>
            </div>
            {form.hazards.map((hazard, index) => (
              <div key={`hazard-${index}`} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
                <FormField label="Hazard category" htmlFor={`hazard-${index}`}>
                  <MasterDataSelect
                    id={`hazard-${index}`}
                    value={hazard.hazardCategoryId}
                    options={hazards}
                    disabled={isReadOnly || masterDataLoading}
                    placeholder="Select hazard"
                    onChange={(hazardCategoryId) => {
                      const hazardRows = [...form.hazards];
                      hazardRows[index] = { ...hazard, hazardCategoryId };
                      setForm({ ...form, hazards: hazardRows });
                    }}
                  />
                </FormField>
                <FormField label="Description" htmlFor={`hazard-desc-${index}`}>
                  <input
                    id={`hazard-desc-${index}`}
                    className={fieldClassName}
                    value={hazard.description}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const hazards = [...form.hazards];
                      hazards[index] = { ...hazard, description: e.target.value };
                      setForm({ ...form, hazards });
                    }}
                  />
                </FormField>
              </div>
            ))}
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">PPE</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isReadOnly}
                onClick={() =>
                  setForm({
                    ...form,
                    ppe: [...form.ppe, { ppeCatalogueId: "", quantity: 1 }],
                  })
                }
              >
                Add PPE
              </Button>
            </div>
            {form.ppe.map((item, index) => (
              <div key={`ppe-${index}`} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
                <FormField label="PPE item" htmlFor={`ppe-${index}`}>
                  <MasterDataSelect
                    id={`ppe-${index}`}
                    value={item.ppeCatalogueId}
                    options={ppeItems}
                    disabled={isReadOnly || masterDataLoading}
                    placeholder="Select PPE"
                    onChange={(ppeCatalogueId) => {
                      const ppe = [...form.ppe];
                      ppe[index] = { ...item, ppeCatalogueId };
                      setForm({ ...form, ppe });
                    }}
                  />
                </FormField>
                <FormField label="Quantity" htmlFor={`ppe-qty-${index}`}>
                  <input
                    id={`ppe-qty-${index}`}
                    type="number"
                    min={1}
                    className={fieldClassName}
                    value={item.quantity}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const ppe = [...form.ppe];
                      ppe[index] = { ...item, quantity: Number(e.target.value) || 1 };
                      setForm({ ...form, ppe });
                    }}
                  />
                </FormField>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Executors</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isReadOnly}
              onClick={() =>
                setForm({
                  ...form,
                  executors: [...form.executors, { workforceUserId: "", isPrimary: false }],
                })
              }
            >
              Add executor
            </Button>
          </div>
          {form.executors.map((executor, index) => (
            <div key={`executor-${index}`} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_auto]">
              <FormField
                label="Executor"
                htmlFor={`executor-${index}`}
                hint="Defaults to you so execution works later."
              >
                <select
                  id={`executor-${index}`}
                  className={fieldClassName}
                  value={executor.workforceUserId}
                  disabled={isReadOnly || masterDataLoading}
                  onChange={(event) => {
                    const executors = [...form.executors];
                    executors[index] = { ...executor, workforceUserId: event.target.value };
                    setForm({ ...form, executors });
                  }}
                >
                  <option value="">Select executor</option>
                  {executorOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {formatWorkforceOptionLabel(person)}
                    </option>
                  ))}
                </select>
              </FormField>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={executor.isPrimary}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    const executors = [...form.executors];
                    executors[index] = { ...executor, isPrimary: e.target.checked };
                    setForm({ ...form, executors });
                  }}
                />
                Primary executor
              </label>
            </div>
          ))}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="grid gap-6">
          <PermitSummary form={form} status={status} reference={reference} />
          <div className="grid gap-3">
            <h2 className="text-sm font-semibold">Attachments</h2>
            <FileUploadField
              id="permit-attachment"
              label="Add attachment"
              hint="Supporting documents, photos, or drawings"
              disabled={isReadOnly || isUploadingAttachment}
              value={pendingAttachment}
              onChange={(file) => {
                setPendingAttachment(file);
                if (file) {
                  void (async () => {
                    setIsUploadingAttachment(true);
                    setApiError(null);
                    try {
                      await handleUpload(file);
                      setPendingAttachment(null);
                    } finally {
                      setIsUploadingAttachment(false);
                    }
                  })();
                }
              }}
            />
            <ul className="grid gap-2 text-sm">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span>
                    {attachment.fileName} ({Math.round(attachment.fileSize / 1024)} KB)
                  </span>
                  {status === "draft" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemoveAttachment(attachment.id)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={handleBack} disabled={isSaving || isSubmitting}>
            Back
          </Button>
        ) : null}
        {status === "draft" ? (
          <Button type="button" variant="secondary" onClick={() => void handleSaveDraft()} disabled={isSaving || isSubmitting}>
            {isSaving ? "Saving..." : "Save draft"}
          </Button>
        ) : null}
        {step < PERMIT_WIZARD_STEPS.length - 1 ? (
          <Button type="button" onClick={() => void handleNext()} disabled={isSaving || isSubmitting || isReadOnly}>
            {isSaving ? "Saving..." : "Next"}
          </Button>
        ) : (
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || isReadOnly}>
            {isSubmitting ? "Submitting..." : "Submit permit"}
          </Button>
        )}
      </div>
    </div>
  );
}
