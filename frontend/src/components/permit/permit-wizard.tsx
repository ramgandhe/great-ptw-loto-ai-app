"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ApiError } from "@/lib/api";
import { getProfile } from "@/lib/auth/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { masterDataApi, type MasterDataRecord } from "@/lib/master-data/api";
import {
  departmentsApi,
  locationsApi,
  machineryApi,
  plantsApi,
  workstationsApi,
} from "@/lib/organisation/api";
import type { MachineryRecord } from "@/lib/organisation/types";
import { permitTemplatesApi, type PermitTemplate, type TemplatePrefillSource } from "@/lib/organisation/templates";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { gasTestingApi, type GasTestingRecord } from "@/lib/master-data/api";
import {
  createPermit,
  getPermit,
  removePermitAttachment,
  savePermitDraft,
  submitPermit,
  uploadPermitAttachment,
} from "@/lib/permit/api";
import {
  applicableTemplates,
  canRoleEditWizardStep,
  canRoleSubmitPermit,
  createEmptyPermitForm,
  formToSavePayload,
  getWizardStepOwner,
  missingRequired,
  PERMIT_WIZARD_STEPS,
  permitDetailToForm,
  shouldSaveExecutorPayload,
  validateStep,
} from "@/lib/permit/form";
import type {
  FormAnswer,
  PermitAttachment,
  PermitDetail,
  PermitFormState,
} from "@/lib/permit/types";
import { isEditablePermitStatus } from "@/lib/permit/status";
import {
  listPermitExecutors,
  listPermitSafetyOfficers,
  listPermitViewers,
} from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { ensureEndAfterStart } from "@/lib/datetime";
import { Copy, X } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { useWorkQueue } from "@/lib/work-queue-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { DraftBanner } from "./draft-banner";
import { fieldClassName, FormField } from "./form-field";
import { MasterDataSelect } from "./master-data-select";
import { formatWorkforceOptionLabel } from "@/components/lototo/select-field";
import { PlannedDateTimeField } from "./planned-datetime-field";
import { PermitStepNav } from "./permit-step-nav";
import { PermitSummary } from "./permit-summary";
import { TemplateFormFill } from "./template-form-fill";
import { ValidationSummary } from "./validation-summary";

function executorRoleLabel(kind?: "internal" | "contractor" | "agency") {
  if (kind === "agency") {
    return "Agency contact";
  }
  if (kind === "contractor") {
    return "Contractor";
  }
  return "Job executor";
}

/** Removes one row of a repeating list (viewer, hazard, PPE, executor…). */
function RemoveRowButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={label} title={label} onClick={onClick} className="shrink-0 text-muted-foreground hover:text-destructive">
      <X aria-hidden />
    </Button>
  );
}

function PersonSelect({
  id,
  value,
  disabled,
  options,
  onChange,
  placeholder,
  internalGroupLabel,
  externalGroupLabel = "External — contractors and agencies",
}: {
  id: string;
  value: string;
  disabled: boolean;
  options: WorkforceRecord[];
  onChange: (value: string) => void;
  placeholder: string;
  internalGroupLabel: string;
  externalGroupLabel?: string;
}) {
  const internal = options.filter(
    (person) =>
      person.executorKind !== "contractor" && person.executorKind !== "agency",
  );
  const external = options.filter(
    (person) =>
      person.executorKind === "contractor" || person.executorKind === "agency",
  );
  return (
    <select
      id={id}
      className={fieldClassName}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {internal.length > 0 ? (
        <optgroup label={internalGroupLabel}>
          {internal.map((person) => (
            <option key={person.id} value={person.id}>
              {formatWorkforceOptionLabel(person)}
            </option>
          ))}
        </optgroup>
      ) : null}
      {external.length > 0 ? (
        <optgroup label={externalGroupLabel}>
          {external.map((person) => (
            <option key={person.id} value={person.id}>
              {formatWorkforceOptionLabel(person)}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}

type PermitWizardProps = {
  mode: "create" | "edit";
  initialDetail?: PermitDetail;
};

/** Local "YYYY-MM-DDTHH:mm" for form fields. */
function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** One-tap schedules for the common cases, instead of picking four date and time values. */
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
    { label: "Tomorrow, 08:00 to 16:00", start: localInput(tomorrow), end: localInput(tomorrowEnd) },
    { label: "5 days from tomorrow", start: localInput(tomorrow), end: localInput(weekEnd) },
  ];
}

export function PermitWizard({ mode, initialDetail }: PermitWizardProps) {
  const router = useRouter();
  const { permits: visiblePermits } = useWorkQueue();
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [permitId, setPermitId] = useState<string | undefined>(
    initialDetail?.permit.id,
  );
  const [form, setForm] = useState<PermitFormState>(
    initialDetail ? permitDetailToForm(initialDetail) : createEmptyPermitForm(),
  );
  const [attachments, setAttachments] = useState<PermitAttachment[]>(
    initialDetail?.attachments ?? [],
  );
  const [reference, setReference] = useState<string | null>(
    initialDetail?.permit.reference ?? null,
  );
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
  const [machineryLototo, setMachineryLototo] = useState<LototoPlan[]>([]);
  const [workstationGasTesting, setWorkstationGasTesting] = useState<
    GasTestingRecord[]
  >([]);
  const { roles: authRoles, profile: authProfile } = useAuthProfile();
  const [templates, setTemplates] = useState<PermitTemplate[]>([]);
  // Until templates load, saves leave stored answers alone rather than pruning them.
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [executorOptions, setExecutorOptions] = useState<WorkforceRecord[]>([]);
  const [viewerOptions, setViewerOptions] = useState<WorkforceRecord[]>([]);
  const [safetyOfficerOptions, setSafetyOfficerOptions] = useState<
    WorkforceRecord[]
  >([]);
  const [userRoles, setUserRoles] = useState<string[]>(authRoles);
  const [masterDataLoading, setMasterDataLoading] = useState(true);

  useEffect(() => {
    if (authRoles.length > 0) {
      setUserRoles(authRoles);
    }
  }, [authRoles]);

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
      listPermitExecutors(),
      listPermitViewers().catch(() => []),
      listPermitSafetyOfficers().catch(() => []),
      getProfile(),
      permitTemplatesApi.list().then(
        (rows) => ({ rows, ok: true }),
        () => ({ rows: [] as PermitTemplate[], ok: false }),
      ),
    ])
      .then(
        ([
          permitTypeRows,
          plantRows,
          departmentRows,
          locationRows,
          workstationRows,
          machineryRows,
          hazardRows,
          ppeRows,
          executorUsers,
          viewerUsers,
          safetyOfficerUsers,
          profile,
          templateResult,
        ]) => {
          setTemplates(templateResult.rows);
          setTemplatesLoaded(templateResult.ok);
          setPermitTypes(permitTypeRows);
          setPlants(plantRows);
          setDepartments(departmentRows);
          setLocations(locationRows);
          setWorkstations(workstationRows);
          setMachinery(machineryRows);
          setHazards(hazardRows);
          setPpeItems(ppeRows);

          const displayName =
            [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
            profile.username;
          const isOperator = profile.roles.includes("operator");
          const byId = new Map<string, WorkforceRecord>();
          for (const user of executorUsers) {
            const name =
              user.name ||
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email ||
              user.username;
            byId.set(user.id, {
              id: user.id,
              name: user.id === profile.id ? `${name} (you)` : name,
              email: user.email ?? null,
              role: executorRoleLabel(user.executorKind),
              executorKind: user.executorKind ?? "internal",
            });
          }
          if (isOperator && !byId.has(profile.id)) {
            byId.set(profile.id, {
              id: profile.id,
              name: `${displayName} (you)`,
              email: profile.email ?? null,
              role: "Job executor",
              executorKind: "internal",
            });
          }
          setExecutorOptions(
            Array.from(byId.values()).sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          );
          setViewerOptions(
            viewerUsers.map((user) => ({
              id: user.id,
              name:
                user.name ||
                [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                user.email ||
                user.username,
              email: user.email ?? null,
            })),
          );
          setSafetyOfficerOptions(
            safetyOfficerUsers.map((user) => ({
              id: user.id,
              name:
                user.name ||
                [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                user.email ||
                user.username,
              email: user.email ?? null,
            })),
          );
          setUserRoles(profile.roles);

          setForm((current) => {
            const executors = (current.executors ?? []).map((executor) => ({
              workforceUserId: executor?.workforceUserId ?? "",
              isPrimary: executor?.isPrimary ?? false,
            }));
            if (executors.some((executor) => executor.workforceUserId.trim())) {
              return { ...current, executors };
            }
            if (isOperator) {
              return {
                ...current,
                currentStep: 2,
                executors: [{ workforceUserId: profile.id, isPrimary: true }],
              };
            }
            return {
              ...current,
              executors: [{ workforceUserId: "", isPrimary: true }],
            };
          });
        },
      )
      .catch((error) => {
        setApiError(
          error instanceof ApiError
            ? error.message
            : "Failed to load master data",
        );
      })
      .finally(() => setMasterDataLoading(false));
  }, []);

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
    gasTestingApi
      .list(form.workstationId)
      .then(setWorkstationGasTesting)
      .catch(() => setWorkstationGasTesting([]));
  }, [form.workstationId]);

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
    const roles = authRoles.length > 0 ? authRoles : userRoles;
    const payload = formToSavePayload(form, {
      executorOnly: shouldSaveExecutorPayload(roles),
    });
    if (templatesLoaded) {
      // Answers for templates that no longer apply (the permit type changed) are dropped.
      const ids = new Set(applicableTemplates(templates, form.permitTypeId).map((t) => t.id));
      payload.formResponses = payload.formResponses?.filter((response) => ids.has(response.templateId));
    } else {
      delete payload.formResponses;
    }

    if (!permitId) {
      const created = await createPermit({
        permitTypeId: form.permitTypeId,
        title: form.title,
        workScope: form.workScope,
        currentStep: form.currentStep,
      });
      setPermitId(created.permit.id);
      setStatus(created.permit.status);
      // Update the address only: a router navigation would remount the wizard on the saved
      // step, so the first Next click appeared to do nothing.
      window.history.replaceState(null, "", `/permits/${created.permit.id}/edit`);
      return created.permit.id;
    }

    await savePermitDraft(permitId, payload);
    return permitId;
  }, [authRoles, form, permitId, templates, templatesLoaded, userRoles]);

  const forms = applicableTemplates(templates, form.permitTypeId);
  const signerName =
    [authProfile?.firstName, authProfile?.lastName].filter(Boolean).join(" ") || authProfile?.displayName || "";

  /** Fills empty "fill from permit" fields from what the permit already says, so nothing is typed twice. */
  const withPrefill = (current: PermitFormState): PermitFormState => {
    const nameOf = (list: { id: string; name: string }[], id: string) => list.find((row) => row.id === id)?.name ?? "";
    const crew = current.executors
      .map((e) => executorOptions.find((o) => o.id === e.workforceUserId)?.name.replace(/ \(you\)$/, ""))
      .filter((name): name is string => Boolean(name));
    const sources: Record<TemplatePrefillSource, string | number | undefined> = {
      department: nameOf(departments, current.departmentId) || undefined,
      location: [nameOf(locations, current.locationId), nameOf(workstations, current.workstationId)].filter(Boolean).join(", ") || undefined,
      equipment: nameOf(machinery, current.machineryId) || undefined,
      "job-description": [current.title, current.workScope].filter((v) => v.trim()).join("\n\n") || undefined,
      "valid-from": current.plannedStartAt.slice(0, 10) || undefined,
      "valid-to": current.plannedEndAt.slice(0, 10) || undefined,
      "crew-names": crew.join(", ") || undefined,
      "crew-count": crew.length || undefined,
    };
    const formResponses = { ...current.formResponses };
    for (const template of applicableTemplates(templates, current.permitTypeId)) {
      const answers = { ...(formResponses[template.id] ?? {}) };
      for (const field of template.config?.sections.flatMap((section) => section.fields) ?? []) {
        const source = field.prefill ? sources[field.prefill] : undefined;
        if (source === undefined || answers[field.id] !== undefined) continue;
        const value: FormAnswer = field.type === "number" ? Number(source) : String(source);
        if (typeof value === "number" && !Number.isFinite(value)) continue;
        answers[field.id] = value;
      }
      formResponses[template.id] = answers;
    }
    return { ...current, formResponses };
  };

  const goToStep = (current: PermitFormState, nextStep: number): PermitFormState => {
    const next = { ...current, currentStep: nextStep };
    return nextStep === 4 ? withPrefill(next) : next;
  };

  const recentPermits = [...visiblePermits]
    // Drafts, cancelled and rejected permits make poor templates.
    .filter((p) => !["draft", "cancelled", "rejected", "deferred"].includes(p.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  /** Prefill from an earlier permit so repeat work isn't typed again; dates are left for the new job. */
  const startFrom = async (sourceId: string) => {
    setIsSaving(true);
    setApiError(null);
    try {
      const source = await getPermit(sourceId);
      const copy = permitDetailToForm(source);
      // Check sheets and signatures are never copied: every job is checked and signed afresh.
      setForm({ ...copy, plannedStartAt: "", plannedEndAt: "", formResponses: {}, currentStep: 0 });
      setCopiedFrom(source.permit.reference ?? source.permit.title);
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "That permit could not be copied. Fill in the form instead.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setApiError(null);
    try {
      await persistDraft();
    } catch (error) {
      setApiError(
        error instanceof ApiError ? error.message : "Failed to save draft",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    const stepErrors = validateStep(form, form.currentStep, forms);
    setErrors(stepErrors);
    if (stepErrors.length > 0) {
      return;
    }

    setIsSaving(true);
    setApiError(null);
    try {
      await persistDraft();
      setForm((current) =>
        goToStep(current, Math.min(current.currentStep + 1, PERMIT_WIZARD_STEPS.length - 1)),
      );
    } catch (error) {
      setApiError(
        error instanceof ApiError ? error.message : "Failed to save progress",
      );
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
    const allErrors = PERMIT_WIZARD_STEPS.flatMap((_, index) =>
      validateStep(form, index, forms),
    );
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
      setApiError(
        error instanceof ApiError ? error.message : "Failed to submit permit",
      );
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
      setApiError(
        error instanceof ApiError
          ? error.message
          : "Failed to upload attachment",
      );
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!permitId) {
      return;
    }

    await removePermitAttachment(permitId, attachmentId);
    setAttachments((current) =>
      current.filter((item) => item.id !== attachmentId),
    );
  };

  const isReadOnly = !isEditablePermitStatus(status);
  const isResubmit = status === "deferred" || status === "rejected";
  const step = form.currentStep;
  const canEditStep = !isReadOnly && canRoleEditWizardStep(userRoles, step);
  const canSubmit = canRoleSubmitPermit(userRoles);
  const stepOwner = getWizardStepOwner(step);
  const isOperatorPhase = stepOwner === "operator";
  const isIssuerPhase = stepOwner === "job-issuer";
  const fieldDisabled = isReadOnly || !canEditStep;

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        back={permitId ? { href: `/permits/${permitId}`, label: "Back to permit" } : { href: "/permits", label: "Permits" }}
        title={mode === "create" ? "Create permit" : isResubmit ? "Revise and resubmit permit" : "Edit draft permit"}
        description={
          isOperatorPhase
            ? "Complete on-site operational details. Executors do not approve permits."
            : step === 4
              ? "Fill in the permit form and check sheets for this type of work. The issuer or the assigned executor can complete them."
              : isIssuerPhase && step < 4
                ? "Enter core permit information, assign an executor, then hand off for on-site details."
                : "Review executor details and submit the permit for HOD approval."
        }
      />

      {status === "draft" ? <DraftBanner /> : null}
      {!canEditStep && !isReadOnly ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          This step is owned by the{" "}
          {stepOwner === "operator" ? "job executor" : "job issuer"}. You can
          view it but cannot edit it.
        </p>
      ) : null}
      <PermitStepNav
        currentStep={step}
        onStepClick={(nextStep) => {
          if (canRoleEditWizardStep(userRoles, nextStep) || !isReadOnly) {
            setForm((current) => goToStep(current, nextStep));
          }
        }}
      />
      <ValidationSummary errors={errors} />
      {apiError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError}
        </div>
      ) : null}

      {mode === "create" && !permitId && step === 0 && recentPermits.length > 0 && !fieldDisabled ? (
        <section aria-labelledby="start-from" className="rounded-xl border border-border bg-card p-4">
          <h2 id="start-from" className="text-sm font-semibold">
            Repeat work? Start from a recent permit
          </h2>
          <p className="text-sm text-muted-foreground">
            Copies the type, scope, place, crew and safety controls. You only set the new dates.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recentPermits.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={isSaving}
                onClick={() => void startFrom(p.id)}
                className="flex max-w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <Copy className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{p.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(p.createdAt)}</span>
              </button>
            ))}
          </div>
          {copiedFrom ? (
            <p role="status" className="mt-3 text-sm font-medium text-(--status-success)">
              Copied from {copiedFrom}. Check the title and scope, then continue.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <p id="permit-type-label" className="text-sm font-medium">
              Permit type
            </p>
            {masterDataLoading ? (
              <p className="text-sm text-muted-foreground">Loading permit types…</p>
            ) : permitTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No permit types yet. An administrator adds them under Organisation, Permit types.
              </p>
            ) : (
              <div role="radiogroup" aria-labelledby="permit-type-label" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {permitTypes.map((type) => {
                  const selected = form.permitTypeId === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={fieldDisabled}
                      onClick={() => setForm({ ...form, permitTypeId: type.id })}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-60",
                        selected ? "border-foreground bg-foreground/5 font-semibold" : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-full bg-border"
                        style={type.color ? { backgroundColor: type.color } : undefined}
                      />
                      {type.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <FormField label="Title" htmlFor="title">
            <input
              id="title"
              className={fieldClassName}
              value={form.title}
              disabled={fieldDisabled}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </FormField>
          <FormField
            label="Work scope"
            htmlFor="workScope"
            className="md:col-span-2"
          >
            <textarea
              id="workScope"
              className={`${fieldClassName} min-h-28 py-2`}
              value={form.workScope}
              disabled={fieldDisabled}
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
              disabled={fieldDisabled || masterDataLoading}
              placeholder="Select plant"
              onChange={(plantId) => setForm({ ...form, plantId })}
            />
          </FormField>
          <FormField label="Department" htmlFor="departmentId">
            <MasterDataSelect
              id="departmentId"
              value={form.departmentId}
              options={departments}
              disabled={fieldDisabled || masterDataLoading}
              placeholder="Select department"
              onChange={(departmentId) => setForm({ ...form, departmentId })}
            />
          </FormField>
          <FormField label="Location" htmlFor="locationId">
            <MasterDataSelect
              id="locationId"
              value={form.locationId}
              options={locations}
              disabled={fieldDisabled || masterDataLoading}
              placeholder="Select location"
              onChange={(locationId) => setForm({ ...form, locationId })}
            />
          </FormField>
          <FormField
            label="Primary executor"
            htmlFor="primary-executor"
            hint="Internal Job executors, or an external contractor / agency contact. They complete on-site details; the job issuer submits."
          >
            <PersonSelect
              id="primary-executor"
              value={form.executors[0]?.workforceUserId ?? ""}
              disabled={fieldDisabled || masterDataLoading}
              options={executorOptions}
              placeholder="Select executors"
              internalGroupLabel="Internal — Job executors"
              onChange={(workforceUserId) =>
                setForm({
                  ...form,
                  executors: [{ workforceUserId, isPrimary: true }],
                })
              }
            />
          </FormField>
          <div className="md:col-span-2 grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Viewers (optional)</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fieldDisabled}
                onClick={() =>
                  setForm({
                    ...form,
                    viewers: [...form.viewers, { workforceUserId: "" }],
                  })
                }
              >
                Add Viewer
              </Button>
            </div>
            {form.viewers.map((viewer, index) => (
              <div key={`viewer-${index}`} className="flex items-center gap-2">
                <PersonSelect
                  id={`viewer-${index}`}
                  value={viewer.workforceUserId}
                  disabled={fieldDisabled || masterDataLoading}
                  options={viewerOptions.filter(
                    (person) => person.id === viewer.workforceUserId || !form.viewers.some((v) => v.workforceUserId === person.id),
                  )}
                  placeholder={viewerOptions.length ? "Select a person" : "No people in this organisation yet"}
                  internalGroupLabel="People in this organisation"
                  onChange={(workforceUserId) => {
                    const viewers = [...form.viewers];
                    viewers[index] = { workforceUserId };
                    setForm({ ...form, viewers });
                  }}
                />
                <RemoveRowButton
                  label="Remove viewer"
                  disabled={fieldDisabled}
                  onClick={() => setForm({ ...form, viewers: form.viewers.filter((_, i) => i !== index) })}
                />
              </div>
            ))}
          </div>
          <FormField label="Planned start" htmlFor="plannedStartAt">
            <PlannedDateTimeField
              id="plannedStartAt"
              value={form.plannedStartAt}
              disabled={fieldDisabled}
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
            hint={
              form.plannedStartAt ? "Must be after planned start" : undefined
            }
          >
            <PlannedDateTimeField
              id="plannedEndAt"
              value={form.plannedEndAt}
              minValue={form.plannedStartAt || undefined}
              disabled={isReadOnly || !form.plannedStartAt}
              onChange={(plannedEndAt) => setForm({ ...form, plannedEndAt })}
            />
          </FormField>
          {!fieldDisabled ? (
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <span className="text-sm text-muted-foreground">Quick schedule:</span>
              {schedulePresets().map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, plannedStartAt: preset.start, plannedEndAt: preset.end }))}
                  className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Workstation" htmlFor="workstationId">
              <MasterDataSelect
                id="workstationId"
                value={form.workstationId}
                options={workstations}
                disabled={fieldDisabled || masterDataLoading}
                placeholder="Select workstation"
                onChange={(workstationId) =>
                  setForm((current) => ({
                    ...current,
                    workstationId,
                    machineryId:
                      current.machineryId &&
                      machinery.some(
                        (item) =>
                          item.id === current.machineryId &&
                          item.workstationId !== workstationId,
                      )
                        ? ""
                        : current.machineryId,
                    gasTesting:
                      workstationId === current.workstationId
                        ? current.gasTesting
                        : [],
                    gasTestingRequired: workstationId
                      ? current.gasTestingRequired
                      : false,
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
                    ? machinery.filter(
                        (item) => item.workstationId === form.workstationId,
                      )
                    : machinery
                }
                disabled={fieldDisabled || masterDataLoading}
                placeholder="Select machinery"
                onChange={(machineryId) =>
                  setForm({
                    ...form,
                    machineryId,
                    lototo: machineryId === form.machineryId ? form.lototo : [],
                  })
                }
              />
            </FormField>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Safety officers (optional)
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fieldDisabled}
                onClick={() =>
                  setForm({
                    ...form,
                    safetyOfficers: [
                      ...form.safetyOfficers,
                      { workforceUserId: "" },
                    ],
                  })
                }
              >
                Add safety officer
              </Button>
            </div>
            {form.safetyOfficers.map((officer, index) => (
              <div key={`so-${index}`} className="flex items-center gap-2">
              <PersonSelect
                id={`safety-officer-${index}`}
                value={officer.workforceUserId}
                disabled={fieldDisabled || masterDataLoading}
                options={safetyOfficerOptions}
                placeholder="Select Safety officers"
                internalGroupLabel="Internal Safety Officers"
                onChange={(workforceUserId) => {
                  const safetyOfficers = [...form.safetyOfficers];
                  safetyOfficers[index] = { workforceUserId };
                  setForm({ ...form, safetyOfficers });
                }}
              />
              <RemoveRowButton
                label="Remove safety officer"
                disabled={fieldDisabled}
                onClick={() => setForm({ ...form, safetyOfficers: form.safetyOfficers.filter((_, i) => i !== index) })}
              />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.lototoRequired}
              disabled={fieldDisabled || !form.machineryId}
              onChange={(e) =>
                setForm({
                  ...form,
                  lototoRequired: e.target.checked,
                  lototo: e.target.checked ? form.lototo : [],
                })
              }
            />
            LOTOTO required
            {!form.machineryId ? <span className="text-muted-foreground">(choose machinery above first)</span> : null}
          </label>
          {form.lototoRequired ? (
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">LOTOTO</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fieldDisabled || machineryLototo.length === 0}
                  onClick={() =>
                    setForm({
                      ...form,
                      lototo: [...form.lototo, { lototoPlanId: "" }],
                    })
                  }
                >
                  Add LOTOTO
                </Button>
              </div>
              {machineryLototo.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This machine has no LOTOTO plan yet.{" "}
                  <a
                    href={`/lototo?new=1&machineryId=${form.machineryId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-(--act-do) underline underline-offset-2"
                  >
                    Create one in a new tab
                  </a>
                  , then{" "}
                  <button
                    type="button"
                    className="font-medium underline underline-offset-2"
                    onClick={() =>
                      void listLototoPlans({ machineryId: form.machineryId }).then(setMachineryLototo).catch(() => setMachineryLototo([]))
                    }
                  >
                    refresh the list
                  </button>
                  .
                </p>
              ) : null}
              {form.lototo.map((item, index) => (
                <div key={`lototo-${index}`} className="flex items-end gap-2">
                <FormField
                  label="LOTOTO procedure"
                  htmlFor={`lototo-${index}`}
                  className="flex-1"
                >
                  <MasterDataSelect
                    id={`lototo-${index}`}
                    value={item.lototoPlanId}
                    options={machineryLototo.map((plan) => ({
                      id: plan.id,
                      name: plan.title,
                      code: plan.reference,
                    }))}
                    disabled={fieldDisabled}
                    placeholder="Select LOTOTO"
                    onChange={(lototoPlanId) => {
                      const lototo = [...form.lototo];
                      lototo[index] = { lototoPlanId };
                      setForm({ ...form, lototo });
                    }}
                  />
                </FormField>
                <RemoveRowButton
                  label="Remove LOTOTO procedure"
                  disabled={fieldDisabled}
                  onClick={() => setForm({ ...form, lototo: form.lototo.filter((_, i) => i !== index) })}
                />
                </div>
              ))}
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.gasTestingRequired}
              disabled={fieldDisabled || !form.workstationId}
              onChange={(e) =>
                setForm({
                  ...form,
                  gasTestingRequired: e.target.checked,
                  gasTesting: e.target.checked ? form.gasTesting : [],
                })
              }
            />
            Gas testing required
            {!form.workstationId ? <span className="text-muted-foreground">(choose a workstation above first)</span> : null}
          </label>
          {form.gasTestingRequired ? (
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Gas testing</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fieldDisabled || workstationGasTesting.length === 0}
                  onClick={() =>
                    setForm({
                      ...form,
                      gasTesting: [
                        ...form.gasTesting,
                        { gasTestingCatalogueId: "" },
                      ],
                    })
                  }
                >
                  Add gas testing
                </Button>
              </div>
              {workstationGasTesting.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No gas testing items for this workstation. Add them under
                  Organisation → Gas Testing configuration.
                </p>
              ) : null}
              {form.gasTesting.map((item, index) => (
                <div key={`gas-testing-${index}`} className="flex items-end gap-2">
                <FormField
                  label="Gas testing item"
                  htmlFor={`gas-testing-${index}`}
                  className="flex-1"
                >
                  <MasterDataSelect
                    id={`gas-testing-${index}`}
                    value={item.gasTestingCatalogueId}
                    options={workstationGasTesting.map((row) => ({
                      id: row.id,
                      name: `${row.parameter} (${row.minimum}–${row.maximum} ${row.unit})`,
                    }))}
                    disabled={fieldDisabled}
                    placeholder="Select gas testing"
                    onChange={(gasTestingCatalogueId) => {
                      const gasTesting = [...form.gasTesting];
                      gasTesting[index] = { gasTestingCatalogueId };
                      setForm({ ...form, gasTesting });
                    }}
                  />
                </FormField>
                <RemoveRowButton
                  label="Remove gas test"
                  disabled={fieldDisabled}
                  onClick={() => setForm({ ...form, gasTesting: form.gasTesting.filter((_, i) => i !== index) })}
                />
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Hazards</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fieldDisabled}
                onClick={() =>
                  setForm({
                    ...form,
                    hazards: [
                      ...form.hazards,
                      { hazardCategoryId: "", description: "" },
                    ],
                  })
                }
              >
                Add hazard
              </Button>
            </div>
            {form.hazards.map((hazard, index) => (
              <div
                key={`hazard-${index}`}
                className="grid items-end gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_1fr_auto]"
              >
                <FormField label="Hazard category" htmlFor={`hazard-${index}`}>
                  <MasterDataSelect
                    id={`hazard-${index}`}
                    value={hazard.hazardCategoryId}
                    options={hazards}
                    disabled={fieldDisabled || masterDataLoading}
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
                    disabled={fieldDisabled}
                    onChange={(e) => {
                      const hazards = [...form.hazards];
                      hazards[index] = {
                        ...hazard,
                        description: e.target.value,
                      };
                      setForm({ ...form, hazards });
                    }}
                  />
                </FormField>
                <RemoveRowButton
                  label="Remove hazard"
                  disabled={fieldDisabled}
                  onClick={() => setForm({ ...form, hazards: form.hazards.filter((_, i) => i !== index) })}
                />
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
                disabled={fieldDisabled}
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
              <div
                key={`ppe-${index}`}
                className="grid items-end gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_1fr_auto]"
              >
                <FormField label="PPE item" htmlFor={`ppe-${index}`}>
                  <MasterDataSelect
                    id={`ppe-${index}`}
                    value={item.ppeCatalogueId}
                    options={ppeItems}
                    disabled={fieldDisabled || masterDataLoading}
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
                    disabled={fieldDisabled}
                    onChange={(e) => {
                      const ppe = [...form.ppe];
                      ppe[index] = {
                        ...item,
                        quantity: Number(e.target.value) || 1,
                      };
                      setForm({ ...form, ppe });
                    }}
                  />
                </FormField>
                <RemoveRowButton
                  label="Remove PPE item"
                  disabled={fieldDisabled}
                  onClick={() => setForm({ ...form, ppe: form.ppe.filter((_, i) => i !== index) })}
                />
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
              disabled={fieldDisabled}
              onClick={() =>
                setForm({
                  ...form,
                  executors: [
                    ...form.executors,
                    { workforceUserId: "", isPrimary: false },
                  ],
                })
              }
            >
              Add executor
            </Button>
          </div>
          {form.executors.map((executor, index) => (
            <div
              key={`executor-${index}`}
              className="grid items-end gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_auto_auto]"
            >
              <FormField
                label="Executor"
                htmlFor={`executor-${index}`}
                hint="Internal Job executors or external contractors / agency contacts."
              >
                <PersonSelect
                  id={`executor-${index}`}
                  value={executor.workforceUserId ?? ""}
                  disabled={fieldDisabled || masterDataLoading}
                  options={executorOptions}
                  placeholder="Select executors"
                  internalGroupLabel="Internal — Job executors"
                  onChange={(workforceUserId) => {
                    const executors = [...form.executors];
                    executors[index] = { ...executor, workforceUserId };
                    setForm({ ...form, executors });
                  }}
                />
              </FormField>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={executor.isPrimary}
                  disabled={fieldDisabled}
                  onChange={(e) => {
                    const executors = [...form.executors];
                    executors[index] = {
                      ...executor,
                      isPrimary: e.target.checked,
                    };
                    setForm({ ...form, executors });
                  }}
                />
                Primary executor
              </label>
              <RemoveRowButton
                label="Remove executor"
                disabled={fieldDisabled || form.executors.length === 1}
                onClick={() => setForm({ ...form, executors: form.executors.filter((_, i) => i !== index) })}
              />
            </div>
          ))}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="grid gap-4" aria-label="Forms and check sheets">
          {!templatesLoaded && !masterDataLoading ? (
            <p role="alert" className="text-sm text-destructive">The forms for this permit could not be loaded. Reload the page to try again.</p>
          ) : forms.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
              No permit forms or check sheets are linked to{" "}
              {permitTypes.find((type) => type.id === form.permitTypeId)?.name ?? "this permit type"}. Continue to review.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {forms.length === 1 ? "One form applies" : `${forms.length} forms apply`} to{" "}
                {permitTypes.find((type) => type.id === form.permitTypeId)?.name ?? "this permit type"}. Details the permit already holds
                are filled in for you. Questions marked * must be answered before the permit can be submitted.
              </p>
              {forms.map((template) => (
                <TemplateFormFill
                  key={template.id}
                  name={template.name}
                  config={template.config!}
                  answers={form.formResponses[template.id] ?? {}}
                  disabled={fieldDisabled}
                  signerName={signerName}
                  onChange={(answers) =>
                    setForm((current) => ({ ...current, formResponses: { ...current.formResponses, [template.id]: answers } }))
                  }
                />
              ))}
            </>
          )}
        </section>
      ) : null}

      {step === 5 ? (
        <section className="grid gap-6">
          {forms.length ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Forms and check sheets</h2>
              <ul className="mt-2 grid gap-1.5 text-sm">
                {forms.map((template) => {
                  const missing = missingRequired(template, form);
                  return (
                    <li key={template.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{template.name}</span>
                      {missing.length ? (
                        <button
                          type="button"
                          className="text-(--status-warning) hover:underline"
                          onClick={() => setForm((current) => goToStep(current, 4))}
                        >
                          {missing.length} required {missing.length === 1 ? "answer" : "answers"} missing
                        </button>
                      ) : (
                        <span className="text-(--status-success)">Complete</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <PermitSummary
            form={form}
            status={status}
            reference={reference}
            attachments={attachments}
          />
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
                    {attachment.fileName} (
                    {Math.round(attachment.fileSize / 1024)} KB)
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
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={isSaving || isSubmitting}
          >
            Back
          </Button>
        ) : null}
        {status === "draft" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleSaveDraft()}
            disabled={isSaving || isSubmitting}
          >
            {isSaving ? "Saving..." : "Save draft"}
          </Button>
        ) : null}
        {step < PERMIT_WIZARD_STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={() => void handleNext()}
            disabled={isSaving || isSubmitting || !canEditStep}
          >
            {isSaving ? "Saving..." : "Next"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !canSubmit || !canEditStep}
          >
            {isSubmitting ? "Submitting..." : "Submit permit"}
          </Button>
        )}
      </div>
    </div>
  );
}
