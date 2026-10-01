"use client";

import { inUse } from "@/components/organisation/org-status-badge";
import { useEffect, useState } from "react";
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
import type { MachineryRecord, OrgRecord } from "@/lib/organisation/types";
import { permitTemplatesApi, type PermitTemplate, type TemplatePrefillSource } from "@/lib/organisation/templates";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { gasTestingApi, type GasTestingRecord } from "@/lib/master-data/api";
import {
  createPermit,
  getPermit,
  removePermitAttachment,
  savePermitDraft,
  isRevisionConflict,
  submitPermit,
  uploadPermitAttachment,
} from "@/lib/permit/api";
import {
  applicableTemplates,
  canRoleEditWizardStep,
  canRoleSubmitPermit,
  createEmptyPermitForm,
  formToSavePayload,
  PERMIT_EDITOR_SECTIONS,
  type PermitEditorSectionId,
  permitDetailToForm,
  shouldSaveExecutorPayload,
  titleFromScope,
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
    <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={label} title={label} onClick={onClick} className="size-11 shrink-0 text-muted-foreground hover:text-destructive">
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
  const [status, setStatus] = useState(initialDetail?.permit.status ?? "draft");
  // The revision this form was loaded or last saved at; the server refuses saves made against an older one.
  const [revision, setRevision] = useState(initialDetail?.permit.draftRevision ?? 0);
  // Set when someone else saved first: local values stay, and saving again is an explicit choice.
  const [conflict, setConflict] = useState(false);
  const [errors, setErrors] = useState<{ message: string; href?: string }[]>([]);
  // The title follows the scope's first sentence until someone types their own.
  const [titleEdited, setTitleEdited] = useState(
    () => Boolean(initialDetail) && initialDetail!.permit.title !== titleFromScope(initialDetail!.permit.workScope ?? ""),
  );
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [permitTypes, setPermitTypes] = useState<MasterDataRecord[]>([]);
  const [plants, setPlants] = useState<MasterDataRecord[]>([]);
  const [departments, setDepartments] = useState<OrgRecord[]>([]);
  const [locations, setLocations] = useState<OrgRecord[]>([]);
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
          // Inactive records stay on past permits but are not offered for new choices.
          // ponytail: an existing draft that already uses a now-inactive item shows it blank; keep selected ids if that matters.
          setPermitTypes(permitTypeRows.filter(inUse));
          setPlants(plantRows.filter(inUse));
          setDepartments(departmentRows.filter(inUse));
          setLocations(locationRows.filter(inUse));
          setWorkstations(workstationRows.filter(inUse));
          setMachinery(machineryRows.filter(inUse));
          setHazards(hazardRows.filter(inUse));
          setPpeItems(ppeRows.filter(inUse));

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
      .then((rows) => setWorkstationGasTesting(rows.filter(inUse)))
      .catch(() => setWorkstationGasTesting([]));
  }, [form.workstationId]);

  useEffect(() => {
    if (initialDetail) {
      setForm(permitDetailToForm(initialDetail));
      setAttachments(initialDetail.attachments);
      setStatus(initialDetail.permit.status);
      setPermitId(initialDetail.permit.id);
      setRevision(initialDetail.permit.draftRevision);
      setConflict(false);
    }
  }, [initialDetail]);

  /** Every edit by the person goes through here, so the editor knows what is unsaved. */
  const edit: typeof setForm = (update) => {
    setDirty(true);
    setForm(update);
  };

  /** Fills empty "fill from permit" fields from what the permit already says, so nothing is typed twice. */
  const withPrefill = (current: PermitFormState): PermitFormState => {
    const nameOf = (list: { id: string; name: string }[], id: string) => list.find((row) => row.id === id)?.name ?? "";
    const crew = current.executors
      .map((e) => executorOptions.find((o) => o.id === e.workforceUserId)?.name.replace(/ \(you\)$/, ""))
      .filter((name): name is string => Boolean(name));
    // A workstation often carries its location's name; say it once.
    const place = [...new Set([nameOf(locations, current.locationId), nameOf(workstations, current.workstationId)].filter(Boolean))];
    const sources: Record<TemplatePrefillSource, string | number | undefined> = {
      department: nameOf(departments, current.departmentId) || undefined,
      location: place.join(", ") || undefined,
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

  // Prefilled answers follow the permit until someone edits them, and are saved with it.
  const prefilled = withPrefill(form);

  const persistDraft = async () => {
    const roles = authRoles.length > 0 ? authRoles : userRoles;
    const payload = formToSavePayload(prefilled, {
      executorOnly: shouldSaveExecutorPayload(roles),
    });
    if (templatesLoaded) {
      // Answers for templates that no longer apply (the permit type changed) are dropped.
      const ids = new Set(applicableTemplates(templates, form.permitTypeId).map((t) => t.id));
      payload.formResponses = payload.formResponses?.filter((response) => ids.has(response.templateId));
    } else {
      delete payload.formResponses;
    }

    let id = permitId;
    let baseRevision = revision;
    if (!id) {
      const created = await createPermit({
        permitTypeId: form.permitTypeId,
        title: form.title,
        workScope: form.workScope,
        currentStep: form.currentStep,
      });
      // Keep the id before the follow-up save, so a failed save is retried as a save, not a second create.
      id = created.permit.id;
      baseRevision = created.permit.draftRevision;
      setPermitId(id);
      setRevision(baseRevision);
      setStatus(created.permit.status);
      // Update the address only: a router navigation would remount the editor.
      window.history.replaceState(null, "", `/permits/${id}/edit`);
    }

    // Create stores only type, title and scope; this save stores the rest of the form.
    try {
      const saved = await savePermitDraft(id, { ...payload, expectedRevision: baseRevision });
      setRevision(saved.permit.draftRevision);
      setConflict(false);
      return { id, revision: saved.permit.draftRevision };
    } catch (error) {
      if (isRevisionConflict(error)) {
        // Keep the typed values; the next save is the person's explicit choice to replace the newer copy.
        const latest = await getPermit(id);
        setRevision(latest.permit.draftRevision);
        setConflict(true);
      }
      throw error;
    }
  };

  const forms = applicableTemplates(templates, form.permitTypeId);
  const signerName =
    [authProfile?.firstName, authProfile?.lastName].filter(Boolean).join(" ") || authProfile?.displayName || "";

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
      edit({ ...copy, plannedStartAt: "", plannedEndAt: "", formResponses: {}, currentStep: 0 });
      setTitleEdited(copy.title !== titleFromScope(copy.workScope));
      setCopiedFrom(source.permit.reference ?? source.permit.title);
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "That permit could not be copied. Fill in the form instead.");
    } finally {
      setIsSaving(false);
    }
  };

  const isReadOnly = !isEditablePermitStatus(status);
  const isResubmit = status === "deferred" || status === "rejected";
  const canSubmit = canRoleSubmitPermit(userRoles);
  const isExecutor = shouldSaveExecutorPayload(userRoles);
  const editable = (step: number) => !isReadOnly && canRoleEditWizardStep(userRoles, step);
  const missing: Record<PermitEditorSectionId, string[]> = {
    work: validateStep(prefilled, 0),
    place: validateStep(prefilled, 1),
    site: [...validateStep(prefilled, 2, forms, machinery), ...validateStep(prefilled, 3)],
    forms: validateStep(prefilled, 4, forms),
    review: [],
  };

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The executor's part starts at Site and crew; open the editor there.
  useEffect(() => {
    if (!masterDataLoading && isExecutor && mode === "edit") {
      document.getElementById("section-site")?.scrollIntoView({ block: "start" });
    }
  }, [masterDataLoading, isExecutor, mode]);

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setApiError(null);
    setSaveState("saving");
    try {
      await persistDraft();
      setDirty(false);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setApiError(error instanceof ApiError ? error.message : "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    const allErrors = PERMIT_EDITOR_SECTIONS.flatMap((section) =>
      missing[section.id].map((message) => ({ message, href: `#section-${section.id}` })),
    );
    setErrors(allErrors);
    if (allErrors.length > 0) {
      requestAnimationFrame(() => document.getElementById("validation-summary")?.focus());
      return;
    }

    setIsSubmitting(true);
    setApiError(null);
    try {
      // Always save the current edits first; submit only after that save succeeded, at its revision.
      const saved = await persistDraft();
      setDirty(false);
      const result = await submitPermit(saved.id, saved.revision);
      setStatus(result.permit.status);
      router.push(`/permits/${saved.id}`);
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        setErrors((error.details as string[]).map((message) => ({ message })));
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

  const plantOfLocation = (locationId: string) =>
    departments.find((d) => d.id === locations.find((l) => l.id === locationId)?.departmentId)?.plantId ?? "";
  const derivedPlant = plantOfLocation(form.locationId);
  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? "";
  const locationOptions = locations.map((l) => {
    const plant = plantName(plantOfLocation(l.id));
    return plant ? { ...l, name: `${l.name}, ${plant}` } : l;
  });
  const departmentOptions = form.plantId ? departments.filter((d) => d.plantId === form.plantId) : departments;
  const personName = (id: string) =>
    executorOptions.find((o) => o.id === id)?.name ?? (id ? "Person no longer available" : "");
  const hazardRows = form.hazards.filter((h) => h.hazardCategoryId);
  const ppeRows = form.ppe.filter((p) => p.ppeCatalogueId);
  const crewRows = form.executors.filter((e) => (e.workforceUserId ?? "").trim());
  const saveLabel = isExecutor ? "Save preparation" : "Save draft";

  const placeEditable = editable(1);
  const siteEditable = editable(2);
  const formsEditable = editable(4);

  return (
    <div className="flex flex-col gap-5 px-4 pb-28 sm:px-8">
      <PageHeader
        back={permitId ? { href: `/permits/${permitId}`, label: "Back to permit" } : { href: "/permits", label: "Permits" }}
        title={mode === "create" ? "Create permit" : isResubmit ? "Revise and resubmit permit" : "Edit draft permit"}
        description={
          isExecutor
            ? "Add the site details, crew and form answers. The job issuer submits."
            : "Describe the work and set the place, time and executor. Submit once the executor has added the site details."
        }
      >
        <nav aria-label="Permit sections">
          {/* One row on every width; it scrolls sideways on a phone instead of wrapping over the form. */}
          <ol className="flex gap-2 overflow-x-auto">
            {PERMIT_EDITOR_SECTIONS.map((section) => {
              const left = missing[section.id].length;
              return (
                <li key={section.id}>
                  <a
                    href={`#section-${section.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
                  >
                    {section.label}
                    {left ? (
                      <span className="text-(--status-warning)">· {left} to do</span>
                    ) : section.id !== "review" ? (
                      <span className="text-(--status-success)">· done</span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      </PageHeader>

      {status === "draft" ? <DraftBanner /> : null}

      {mode === "create" && !permitId && recentPermits.length > 0 && editable(0) ? (
        <details className="rounded-xl border border-border bg-card px-4 py-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Use a previous permit</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Copies the type, scope, place, crew and site controls. Dates, form answers and signatures start empty.
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
        </details>
      ) : null}
      {copiedFrom ? (
        <p role="status" className="text-sm font-medium text-(--status-success)">
          Copied from {copiedFrom}. Check the scope and title, and set the dates.
        </p>
      ) : null}


      <ValidationSummary errors={errors} />
      {apiError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {apiError}
          {conflict ? (
            <p className="mt-2 text-foreground">
              Another person saved this permit after you opened it.{" "}
              <a href={`/permits/${permitId}`} target="_blank" rel="noreferrer" className="underline">
                Open the saved version
              </a>{" "}
              to compare. {saveLabel} again to replace it with what you see here. Submit stays unavailable until then.
            </p>
          ) : null}
        </div>
      ) : null}

      <EditorSection id="work" title="Work" owner="Job issuer" editable={editable(0)} left={missing.work.length}>
        <div className="grid gap-2">
          <p id="permit-type-label" className="text-sm font-medium">
            Permit type
          </p>
          {masterDataLoading ? (
            <p className="text-sm text-muted-foreground">Loading permit types…</p>
          ) : permitTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No permit types yet. An administrator adds them under Organisation, Permit types.</p>
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
                    disabled={!editable(0)}
                    onClick={() => edit({ ...form, permitTypeId: type.id })}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-60",
                      selected ? "border-foreground bg-foreground/5 font-semibold" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span aria-hidden className="size-3 shrink-0 rounded-full bg-border" style={type.color ? { backgroundColor: type.color } : undefined} />
                    {type.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <FormField label="Work scope" htmlFor="workScope" hint="What will be done and how. The title below is suggested from its first sentence.">
          <textarea
            id="workScope"
            className={`${fieldClassName} min-h-24 py-2`}
            value={form.workScope}
            disabled={!editable(0)}
            onChange={(e) => {
              const workScope = e.target.value;
              edit((current) => ({ ...current, workScope, title: titleEdited ? current.title : titleFromScope(workScope) }));
            }}
          />
        </FormField>
        <FormField label="Title" htmlFor="title" hint={titleEdited ? undefined : "Suggested from the scope. Change it if it does not read well."}>
          <input
            id="title"
            className={fieldClassName}
            value={form.title}
            disabled={!editable(0)}
            onChange={(e) => {
              setTitleEdited(true);
              edit({ ...form, title: e.target.value });
            }}
          />
        </FormField>
      </EditorSection>

      <EditorSection id="place" title="Place and schedule" owner="Job issuer" editable={placeEditable} left={missing.place.length}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Location" htmlFor="locationId">
            <MasterDataSelect
              id="locationId"
              value={form.locationId}
              options={locationOptions}
              disabled={!placeEditable || masterDataLoading}
              placeholder="Select location"
              onChange={(locationId) =>
                edit((current) => {
                  const plantId = plantOfLocation(locationId) || current.plantId;
                  // A department from another plant no longer fits; clear it so it is chosen again.
                  const departmentFits = departments.find((d) => d.id === current.departmentId)?.plantId === plantId;
                  return { ...current, locationId, plantId, departmentId: departmentFits ? current.departmentId : "" };
                })
              }
            />
          </FormField>
          {derivedPlant ? (
            <div className="grid gap-1.5 text-sm">
              <span className="font-medium">Plant</span>
              <p className="flex min-h-11 items-center text-muted-foreground">{plantName(derivedPlant)}, from the location</p>
            </div>
          ) : (
            <FormField label="Plant" htmlFor="plantId">
              <MasterDataSelect
                id="plantId"
                value={form.plantId}
                options={plants}
                disabled={!placeEditable || masterDataLoading}
                placeholder="Select plant"
                onChange={(plantId) => edit({ ...form, plantId })}
              />
            </FormField>
          )}
          <FormField label="Department" htmlFor="departmentId" hint={form.plantId ? `Departments of ${plantName(form.plantId)}` : undefined}>
            <MasterDataSelect
              id="departmentId"
              value={form.departmentId}
              options={departmentOptions}
              disabled={!placeEditable || masterDataLoading}
              placeholder="Select department"
              onChange={(departmentId) => edit({ ...form, departmentId })}
            />
          </FormField>
          <FormField
            label="Primary executor"
            htmlFor="primary-executor"
            hint="They add the site details, crew and form answers; you then review and submit."
          >
            <PersonSelect
              id="primary-executor"
              value={form.executors.find((e) => e.isPrimary)?.workforceUserId ?? form.executors[0]?.workforceUserId ?? ""}
              disabled={!placeEditable || masterDataLoading}
              options={executorOptions}
              placeholder="Select executor"
              internalGroupLabel="Internal — Job executors"
              onChange={(workforceUserId) =>
                edit((current) => ({
                  ...current,
                  // Replace the primary only; crew the executor already added stays.
                  executors: [
                    { workforceUserId, isPrimary: true },
                    ...current.executors
                      .filter((e) => !e.isPrimary && e.workforceUserId && e.workforceUserId !== workforceUserId)
                      .map((e) => ({ ...e, isPrimary: false })),
                  ],
                }))
              }
            />
          </FormField>
        </div>
        <div className="grid gap-3">
          {placeEditable ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">When</span>
              {schedulePresets().map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={form.plannedStartAt === preset.start && form.plannedEndAt === preset.end}
                  onClick={() => edit((current) => ({ ...current, plannedStartAt: preset.start, plannedEndAt: preset.end }))}
                  className="min-h-11 rounded-full border border-border px-3.5 text-sm hover:bg-muted aria-pressed:border-foreground aria-pressed:bg-foreground/5 aria-pressed:font-semibold"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Planned start" htmlFor="plannedStartAt">
              <PlannedDateTimeField
                id="plannedStartAt"
                value={form.plannedStartAt}
                disabled={!placeEditable}
                onChange={(plannedStartAt) =>
                  edit((current) => ({
                    ...current,
                    plannedStartAt,
                    plannedEndAt: current.plannedEndAt ? ensureEndAfterStart(plannedStartAt, current.plannedEndAt) : current.plannedEndAt,
                  }))
                }
              />
            </FormField>
            <FormField label="Planned end" htmlFor="plannedEndAt" hint={form.plannedStartAt ? "Must be after planned start" : undefined}>
              <PlannedDateTimeField
                id="plannedEndAt"
                value={form.plannedEndAt}
                minValue={form.plannedStartAt || undefined}
                disabled={!placeEditable || !form.plannedStartAt}
                onChange={(plannedEndAt) => edit({ ...form, plannedEndAt })}
              />
            </FormField>
          </div>
        </div>
        <details className="rounded-lg border border-border px-3 py-2" open={form.viewers.length > 0 || undefined}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
            Viewers (optional){form.viewers.length ? `: ${form.viewers.length}` : ""}
          </summary>
          <div className="mt-3 grid gap-3">
            {form.viewers.map((viewer, index) => (
              <div key={`viewer-${index}`} className="flex items-center gap-2">
                <PersonSelect
                  id={`viewer-${index}`}
                  value={viewer.workforceUserId}
                  disabled={!placeEditable || masterDataLoading}
                  options={viewerOptions.filter(
                    (person) => person.id === viewer.workforceUserId || !form.viewers.some((v) => v.workforceUserId === person.id),
                  )}
                  placeholder={viewerOptions.length ? "Select a person" : "No people in this organisation yet"}
                  internalGroupLabel="People in this organisation"
                  onChange={(workforceUserId) => {
                    const viewers = [...form.viewers];
                    viewers[index] = { workforceUserId };
                    edit({ ...form, viewers });
                  }}
                />
                <RemoveRowButton
                  label="Remove viewer"
                  disabled={!placeEditable}
                  onClick={() => edit({ ...form, viewers: form.viewers.filter((_, i) => i !== index) })}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start"
              disabled={!placeEditable}
              onClick={() => edit({ ...form, viewers: [...form.viewers, { workforceUserId: "" }] })}
            >
              Add viewer
            </Button>
          </div>
        </details>
      </EditorSection>

      <EditorSection
        id="site"
        title="Site and crew"
        owner="Job executor"
        editable={siteEditable}
        left={missing.site.length}
        note="The job executor adds these after you save: workstation, machinery, isolation, gas tests, hazards, PPE and crew."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Workstation" htmlFor="workstationId">
            <MasterDataSelect
              id="workstationId"
              value={form.workstationId}
              options={workstations}
              disabled={!siteEditable || masterDataLoading}
              placeholder="Select workstation"
              onChange={(workstationId) =>
                edit((current) => ({
                  ...current,
                  workstationId,
                  machineryId:
                    current.machineryId && machinery.some((item) => item.id === current.machineryId && item.workstationId !== workstationId)
                      ? ""
                      : current.machineryId,
                  gasTesting: workstationId === current.workstationId ? current.gasTesting : [],
                  gasTestingRequired: workstationId ? current.gasTestingRequired : false,
                }))
              }
            />
          </FormField>
          <FormField label="Machinery" htmlFor="machineryId">
            <MasterDataSelect
              id="machineryId"
              value={form.machineryId}
              options={form.workstationId ? machinery.filter((item) => item.workstationId === form.workstationId) : machinery}
              disabled={!siteEditable || masterDataLoading}
              placeholder="Select machinery"
              onChange={(machineryId) => edit({ ...form, machineryId, lototo: machineryId === form.machineryId ? form.lototo : [] })}
            />
          </FormField>
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.lototoRequired}
            disabled={!siteEditable || !form.machineryId}
            onChange={(e) =>
              edit({
                ...form,
                lototoRequired: e.target.checked,
                // A machine with a single plan: select it straight away.
                lototo: !e.target.checked
                  ? []
                  : form.lototo.length || machineryLototo.length !== 1
                    ? form.lototo
                    : [{ lototoPlanId: machineryLototo[0].id }],
              })
            }
          />
          LOTOTO required
          {!form.machineryId && siteEditable ? <span className="text-muted-foreground">(choose machinery first)</span> : null}
        </label>
        {form.lototoRequired ? (
          <div className="grid gap-3">
            {machineryLototo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This machine has no LOTOTO plan yet.{" "}
                <a href={`/lototo?new=1&machineryId=${form.machineryId}`} target="_blank" rel="noreferrer" className="font-medium text-(--act-do) underline underline-offset-2">
                  Create one in a new tab
                </a>
                , then{" "}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => void listLototoPlans({ machineryId: form.machineryId }).then(setMachineryLototo).catch(() => setMachineryLototo([]))}
                >
                  refresh the list
                </button>
                .
              </p>
            ) : (
              <ChipPicker
                label="LOTOTO procedures"
                options={machineryLototo.map((plan) => ({ id: plan.id, name: plan.reference ? `${plan.title} (${plan.reference})` : plan.title }))}
                selected={form.lototo.map((item) => item.lototoPlanId)}
                disabled={!siteEditable}
                onToggle={(lototoPlanId) =>
                  edit((current) => ({
                    ...current,
                    lototo: current.lototo.some((item) => item.lototoPlanId === lototoPlanId)
                      ? current.lototo.filter((item) => item.lototoPlanId !== lototoPlanId)
                      : [...current.lototo.filter((item) => item.lototoPlanId), { lototoPlanId }],
                  }))
                }
              />
            )}
          </div>
        ) : null}

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.gasTestingRequired}
            disabled={!siteEditable || !form.workstationId}
            onChange={(e) =>
              edit({
                ...form,
                gasTestingRequired: e.target.checked,
                // Start with every gas test set up for this workstation; remove any not needed.
                gasTesting: !e.target.checked
                  ? []
                  : form.gasTesting.length
                    ? form.gasTesting
                    : workstationGasTesting.map((row) => ({ gasTestingCatalogueId: row.id })),
              })
            }
          />
          Gas testing required
          {!form.workstationId && siteEditable ? <span className="text-muted-foreground">(choose a workstation first)</span> : null}
        </label>
        {form.gasTestingRequired ? (
          workstationGasTesting.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No gas tests are set up for this workstation yet.{" "}
              <a href="/organisation/gas-testing" target="_blank" rel="noreferrer" className="font-medium text-(--act-do) underline underline-offset-2">
                Add them in a new tab
              </a>
              , then{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() =>
                  void gasTestingApi
                    .list(form.workstationId)
                    .then((rows) => setWorkstationGasTesting(rows.filter(inUse)))
                    .catch(() => setWorkstationGasTesting([]))
                }
              >
                refresh the list
              </button>
              .
            </p>
          ) : (
            <ChipPicker
              label="Gas tests"
              options={workstationGasTesting.map((row) => ({ id: row.id, name: `${row.parameter} (${row.minimum}–${row.maximum} ${row.unit})` }))}
              selected={form.gasTesting.map((item) => item.gasTestingCatalogueId)}
              disabled={!siteEditable}
              onToggle={(gasTestingCatalogueId) =>
                edit((current) => ({
                  ...current,
                  gasTesting: current.gasTesting.some((item) => item.gasTestingCatalogueId === gasTestingCatalogueId)
                    ? current.gasTesting.filter((item) => item.gasTestingCatalogueId !== gasTestingCatalogueId)
                    : [...current.gasTesting.filter((item) => item.gasTestingCatalogueId), { gasTestingCatalogueId }],
                }))
              }
            />
          )
        ) : null}

        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Hazards</h3>
          <ChipPicker
            label="Hazards"
            options={hazards}
            selected={hazardRows.map((h) => h.hazardCategoryId)}
            disabled={!siteEditable || masterDataLoading}
            onToggle={(hazardCategoryId) =>
              edit((current) => {
                const rows = current.hazards.filter((h) => h.hazardCategoryId);
                return {
                  ...current,
                  hazards: rows.some((h) => h.hazardCategoryId === hazardCategoryId)
                    ? rows.filter((h) => h.hazardCategoryId !== hazardCategoryId)
                    : [...rows, { hazardCategoryId, description: "" }],
                };
              })
            }
          />
          {hazardRows.map((hazard) => (
            <FormField
              key={hazard.hazardCategoryId}
              label={`${hazards.find((h) => h.id === hazard.hazardCategoryId)?.name ?? "Hazard no longer offered"}: notes (optional)`}
              htmlFor={`hazard-desc-${hazard.hazardCategoryId}`}
            >
              <input
                id={`hazard-desc-${hazard.hazardCategoryId}`}
                className={fieldClassName}
                value={hazard.description}
                disabled={!siteEditable}
                onChange={(e) =>
                  edit((current) => ({
                    ...current,
                    hazards: current.hazards.map((h) => (h.hazardCategoryId === hazard.hazardCategoryId ? { ...h, description: e.target.value } : h)),
                  }))
                }
              />
            </FormField>
          ))}
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">PPE</h3>
          <ChipPicker
            label="PPE"
            options={ppeItems}
            selected={ppeRows.map((p) => p.ppeCatalogueId)}
            disabled={!siteEditable || masterDataLoading}
            onToggle={(ppeCatalogueId) =>
              edit((current) => {
                const rows = current.ppe.filter((p) => p.ppeCatalogueId);
                return {
                  ...current,
                  ppe: rows.some((p) => p.ppeCatalogueId === ppeCatalogueId)
                    ? rows.filter((p) => p.ppeCatalogueId !== ppeCatalogueId)
                    : [...rows, { ppeCatalogueId, quantity: 1 }],
                };
              })
            }
          />
          {ppeRows.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ppeRows.map((item) => (
                <FormField
                  key={item.ppeCatalogueId}
                  label={`${ppeItems.find((p) => p.id === item.ppeCatalogueId)?.name ?? "Item no longer offered"}: quantity`}
                  htmlFor={`ppe-qty-${item.ppeCatalogueId}`}
                >
                  <input
                    id={`ppe-qty-${item.ppeCatalogueId}`}
                    type="number"
                    min={1}
                    className={fieldClassName}
                    value={item.quantity}
                    disabled={!siteEditable}
                    onChange={(e) =>
                      edit((current) => ({
                        ...current,
                        ppe: current.ppe.map((p) =>
                          p.ppeCatalogueId === item.ppeCatalogueId ? { ...p, quantity: Number(e.target.value) || 1 } : p,
                        ),
                      }))
                    }
                  />
                </FormField>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Crew</h3>
          <ul className="grid gap-2">
            {crewRows.map((executor) => (
              <li key={executor.workforceUserId} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{personName(executor.workforceUserId)}</span>
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={executor.isPrimary}
                    disabled={!siteEditable}
                    onChange={(e) =>
                      edit((current) => ({
                        ...current,
                        executors: current.executors.map((row) =>
                          row.workforceUserId === executor.workforceUserId ? { ...row, isPrimary: e.target.checked } : row,
                        ),
                      }))
                    }
                  />
                  Primary
                </label>
                <RemoveRowButton
                  label={`Remove ${personName(executor.workforceUserId)}`}
                  disabled={!siteEditable || crewRows.length === 1}
                  onClick={() =>
                    edit((current) => ({
                      ...current,
                      executors: current.executors.filter((row) => row.workforceUserId !== executor.workforceUserId),
                    }))
                  }
                />
              </li>
            ))}
          </ul>
          {siteEditable ? (
            <div className="max-w-md">
              <label htmlFor="add-crew" className="sr-only">
                Add crew member
              </label>
              <PersonSelect
                id="add-crew"
                value=""
                disabled={masterDataLoading}
                options={executorOptions.filter((person) => !crewRows.some((row) => row.workforceUserId === person.id))}
                placeholder="Add crew member"
                internalGroupLabel="Internal — Job executors"
                onChange={(workforceUserId) =>
                  workforceUserId &&
                  edit((current) => ({
                    ...current,
                    executors: [...current.executors.filter((row) => row.workforceUserId), { workforceUserId, isPrimary: false }],
                  }))
                }
              />
            </div>
          ) : null}
        </div>

        <details className="rounded-lg border border-border px-3 py-2" open={form.safetyOfficers.length > 0 || undefined}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
            Safety officers (optional){form.safetyOfficers.length ? `: ${form.safetyOfficers.length}` : ""}
          </summary>
          <div className="mt-3 grid gap-3">
            {form.safetyOfficers.map((officer, index) => (
              <div key={`so-${index}`} className="flex items-center gap-2">
                <PersonSelect
                  id={`safety-officer-${index}`}
                  value={officer.workforceUserId}
                  disabled={!siteEditable || masterDataLoading}
                  options={safetyOfficerOptions}
                  placeholder="Select safety officer"
                  internalGroupLabel="Internal Safety Officers"
                  onChange={(workforceUserId) => {
                    const safetyOfficers = [...form.safetyOfficers];
                    safetyOfficers[index] = { workforceUserId };
                    edit({ ...form, safetyOfficers });
                  }}
                />
                <RemoveRowButton
                  label="Remove safety officer"
                  disabled={!siteEditable}
                  onClick={() => edit({ ...form, safetyOfficers: form.safetyOfficers.filter((_, i) => i !== index) })}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start"
              disabled={!siteEditable}
              onClick={() => edit({ ...form, safetyOfficers: [...form.safetyOfficers, { workforceUserId: "" }] })}
            >
              Add safety officer
            </Button>
          </div>
        </details>
      </EditorSection>

      <EditorSection id="forms" title="Forms and evidence" owner="Job issuer or executor" editable={formsEditable} left={missing.forms.length}>
        {!templatesLoaded && !masterDataLoading ? (
          <p role="alert" className="text-sm text-destructive">The forms for this permit could not be loaded. Reload the page to try again.</p>
        ) : forms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No permit forms or check sheets are linked to {permitTypes.find((type) => type.id === form.permitTypeId)?.name ?? "this permit type"}.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Details the permit already holds are filled in and follow the permit until you change them. Questions marked * must be answered
              before the permit can be submitted.
            </p>
            {forms.map((template) => (
              <TemplateFormFill
                key={template.id}
                name={template.name}
                config={template.config!}
                answers={prefilled.formResponses[template.id] ?? {}}
                disabled={!formsEditable}
                signerName={signerName}
                onChange={(answers) => edit((current) => ({ ...current, formResponses: { ...current.formResponses, [template.id]: answers } }))}
              />
            ))}
          </>
        )}
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">Attachments (optional)</h3>
          <FileUploadField
            id="permit-attachment"
            label="Add attachment"
            hint={permitId ? "Supporting documents, photos, or drawings" : `${saveLabel} first, then add attachments.`}
            disabled={isReadOnly || isUploadingAttachment || !permitId}
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
          {attachments.length ? (
            <ul className="grid gap-2 text-sm">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>
                    {attachment.fileName} ({Math.round(attachment.fileSize / 1024)} KB)
                  </span>
                  {status === "draft" ? (
                    <Button type="button" variant="ghost" className="min-h-11" onClick={() => void handleRemoveAttachment(attachment.id)}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </EditorSection>

      <EditorSection id="review" title="Review" owner="Job issuer" editable left={0}>
        {PERMIT_EDITOR_SECTIONS.some((section) => missing[section.id].length) ? (
          <ul className="grid gap-2 text-sm">
            {PERMIT_EDITOR_SECTIONS.filter((section) => missing[section.id].length).map((section) => (
              <li key={section.id}>
                <a href={`#section-${section.id}`} className="font-medium underline underline-offset-2">
                  {section.label}
                </a>
                <span className="text-muted-foreground">: {missing[section.id].join("; ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-(--status-success)">Everything needed for submission is filled in.</p>
        )}
        <p className="text-sm text-muted-foreground">
          {isExecutor
            ? `${saveLabel} when you are done. The job issuer reviews the permit and submits it for approval.`
            : "Submitting saves your changes and sends the permit for approval. Saving the draft does not authorise any work."}
        </p>
      </EditorSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <p role="status" className="mr-auto text-sm text-muted-foreground">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "error"
              ? "Could not save. Your changes are still here."
              : dirty
                ? "Unsaved changes"
                : saveState === "saved"
                  ? isExecutor
                    ? "Saved. The job issuer reviews next."
                    : "Saved"
                  : ""}
        </p>
        {status === "draft" ? (
          <Button type="button" size="lg" className="min-h-11 px-4" variant={canSubmit ? "secondary" : "default"} onClick={() => void handleSaveDraft()} disabled={isSaving || isSubmitting}>
            {isSaving ? "Saving…" : saveLabel}
          </Button>
        ) : null}
        {canSubmit ? (
          <Button type="button" size="lg" className="min-h-11 px-4" onClick={() => void handleSubmit()} disabled={isSubmitting || isSaving || isReadOnly || conflict}>
            {isSubmitting ? "Submitting…" : isResubmit ? "Resubmit permit" : "Submit permit"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** One section of the permit editor, with its owner and what is left to fill in. */
function EditorSection({
  id,
  title,
  owner,
  editable,
  left,
  note,
  children,
}: {
  id: PermitEditorSectionId;
  title: string;
  owner: string;
  editable: boolean;
  left: number;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      aria-labelledby={`section-${id}-title`}
      // Jumps land below the sticky app header (3.5rem) and page header with the section links.
      style={{ scrollMarginTop: "calc(var(--page-head-h, 0px) + 4.5rem)" }}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`section-${id}-title`} className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">
          {owner}
          {left ? ` · ${left} to do` : ""}
        </p>
      </header>
      {!editable && note ? <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{note}</p> : null}
      {children}
    </section>
  );
}

/** Tap to select or deselect catalogue items; selected items are pressed buttons. */
function ChipPicker({
  label,
  options,
  selected,
  disabled,
  onToggle,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing to choose from yet. An administrator adds these under Organisation.</p>;
  }
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(option.id)}
            className={cn(
              "min-h-11 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-60",
              on ? "border-foreground bg-foreground/5 font-semibold" : "border-border bg-card hover:bg-muted",
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
