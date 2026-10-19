"use client";
import { AppSelect } from "@/components/ui/select";

import { inUse } from "@/components/organisation/org-status-badge";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ApiError } from "@/lib/api";
import { getProfile } from "@/lib/auth/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { masterDataApi, type HazardRecord, type MasterDataRecord } from "@/lib/master-data/api";
import { hazardFitsPermitType } from "@/lib/master-data/hazard-fit";
import { linkedPpeIds, originLabel, placeHazardPlan, ppeForHazards } from "@/lib/permit/place-hazards";
import {
  departmentsApi,
  locationsApi,
  machineryApi,
  plantsApi,
  sitesApi,
  workstationsApi,
} from "@/lib/organisation/api";
import { placeApi, type AssetRecord, type WorkLocationRecord } from "@/lib/place/api";
import { listTenantUsers } from "@/lib/workforce/api";
import type { TenantUser } from "@/lib/workforce/types";
import type { MachineryRecord, OrgRecord } from "@/lib/organisation/types";
import { permitTemplatesApi, type PermitTemplate, type TemplatePrefillSource } from "@/lib/organisation/templates";
import { getLototoProcedure, listLototoProcedures } from "@/lib/lototo/api";
import type { LototoProcedure, LototoProcedureListItem } from "@/lib/lototo/types";
import { gasTestingApi } from "@/lib/master-data/api";
import {
  createPermit,
  getPermit,
  handoffPermitDraft,
  removePermitAttachment,
  returnPermitDraft,
  savePermitDraft,
  isRevisionConflict,
  submitPermit,
  uploadPermitAttachment,
} from "@/lib/permit/api";
import {
  applicableTemplates,
  canRoleEditWizardStep,
  canRoleSubmitPermit,
  catalogueLinesForPermit,
  emptyPermitHazard,
  emptyPermitLototo,
  createEmptyPermitForm,
  formToSavePayload,
  editorSectionsFor,
  ERROR_FIELDS,
  needsSafetyApproval,
  PERMIT_EDITOR_SECTIONS,
  type PermitEditorSectionId,
  permitControlLines,
  permitDetailToForm,
  shouldSaveExecutorPayload,
  shouldSaveSafetyApprovalOnly,
  titleFromScope,
  validateStep,
} from "@/lib/permit/form";
import {
  handoffButtonLabel,
  handoffSectionFor,
  holderNextWork,
  holderStageLabel,
  nextHandoffTarget,
  parseDraftHolder,
  returnButtonLabel,
  returnHandoffTarget,
  returnSectionFor,
  stepsEditableForHolder,
  type DraftHolder,
} from "@/lib/permit/handoff";
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
import { Check, ChevronLeft, ChevronRight, CircleAlert, Copy, Pencil, PenLine, Search, X } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { useWorkQueue } from "@/lib/work-queue-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { FileUploadField } from "@/components/ui/file-upload-field";
import { DraftBanner } from "./draft-banner";
import { fieldClassName, FormField } from "./form-field";
import { MasterDataSelect } from "./master-data-select";
import { formatWorkforceOptionLabel } from "@/components/lototo/select-field";
import { PlannedDateTimeField } from "./planned-datetime-field";
import { TemplateFormFill } from "./template-form-fill";
import { ValidationSummary } from "./validation-summary";
import { LototoAttachFields } from "./lototo-attach-fields";
import { identityFromPermit, PermitSummary } from "./permit-summary";
import { mergeAfterConflict, resolveConflict, type FieldConflict } from "@/lib/permit/conflict";
import { useLeaveGuard } from "@/lib/leave-guard";

function executorRoleLabel(kind?: "internal" | "contractor" | "agency") {
  if (kind === "agency") {
    return "Agency contact";
  }
  if (kind === "contractor") {
    return "Contractor";
  }
  return "Permit operator";
}

const safetyParameterClassName = "flex min-h-11 items-center gap-3 font-sans text-base font-semibold";

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
  ...aria
}: {
  /** Error wiring from FormField, passed to the select itself. */
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
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
    <AppSelect
      id={id}
      {...aria}
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
    </AppSelect>
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

const SITE_SAFETY_STEPS = [
  { id: "place", label: "Location & assets" },
  { id: "hazards", label: "Hazards & controls" },
  { id: "ppe", label: "PPE" },
  { id: "lototo", label: "LOTOTO" },
  { id: "gas", label: "Gas testing" },
  { id: "verification", label: "Verification" },
  { id: "notes", label: "Notes" },
] as const;
type SiteSafetyStep = (typeof SITE_SAFETY_STEPS)[number]["id"];

export function PermitWizard({ mode, initialDetail }: PermitWizardProps) {
  const router = useRouter();
  const { permits: visiblePermits } = useWorkQueue();
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [permitId, setPermitId] = useState<string | undefined>(
    initialDetail?.permit.id,
  );
  const [receiverId, setReceiverId] = useState<string | undefined>(
    initialDetail?.permit.createdBy ?? undefined,
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
  const [draftHolder, setDraftHolder] = useState<DraftHolder>(parseDraftHolder(initialDetail?.permit.draftHolder));
  const [draftHeldBy, setDraftHeldBy] = useState<string | null>(initialDetail?.permit.draftHeldBy ?? initialDetail?.permit.createdBy ?? null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [gasNotice, setGasNotice] = useState<string[] | null>(null);
  const [gasLimitError, setGasLimitError] = useState<string | null>(null);
  const [gasBaselines, setGasBaselines] = useState<Map<string, { minimum: number; maximum: number }>>(new Map());
  const [returnReason, setReturnReason] = useState(initialDetail?.permit.draftReturnReason ?? "");
  const [returnReasonDraft, setReturnReasonDraft] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);
  // Set when someone else saved first: local values stay, and saving again is an explicit choice.
  const [conflict, setConflict] = useState(false);
  // The form as last loaded or saved: the common ancestor when someone else's save has to be merged in.
  const [base, setBase] = useState<PermitFormState>(() => (initialDetail ? permitDetailToForm(initialDetail) : createEmptyPermitForm()));
  // Values both people changed differently; each needs the person's choice before saving again.
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [errors, setErrors] = useState<{ message: string; href?: string; section?: PermitEditorSectionId }[]>([]);
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
  const [sites, setSites] = useState<OrgRecord[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocationRecord[]>([]);
  const [siteAssets, setSiteAssets] = useState<AssetRecord[]>([]);
  const [approverText, setApproverText] = useState("");
  const [people, setPeople] = useState<TenantUser[]>([]);
  const [locationQuery, setLocationQuery] = useState("");
  const [siteSafetyStep, setSiteSafetyStep] = useState<SiteSafetyStep>("place");
  const [hazards, setHazards] = useState<HazardRecord[]>([]);
  const [lototoDetails, setLototoDetails] = useState<Record<string, LototoProcedure>>({});
  const [ppeItems, setPpeItems] = useState<MasterDataRecord[]>([]);
  const [machineryLototo, setMachineryLototo] = useState<LototoProcedureListItem[]>([]);
  const [extraGas, setExtraGas] = useState({ parameter: "", unit: "", minimum: "", maximum: "" });
  const [gasRemovalRequest, setGasRemovalRequest] = useState<{ index: number; reason: string } | null>(null);
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
  const [ppeManualOff, setPpeManualOff] = useState<string[]>([]);
  const [ppeManualOn, setPpeManualOn] = useState<string[]>([]);
  const placeSelectionRef = useRef<string | null>(null);
  // One step at a time. A draft reopens where it was left; the executor's part starts at Site safety.
  const [active, setActive] = useState<PermitEditorSectionId>(() =>
    mode === "edit" && authRoles.includes("safety-officer")
      ? "safety"
      : mode === "edit" && shouldSaveExecutorPayload(authRoles)
        ? "site"
        : (PERMIT_EDITOR_SECTIONS.find((section) => (section.steps as readonly number[]).includes(form.currentStep))?.id ?? "work"),
  );

  useEffect(() => {
    if (authRoles.length > 0) {
      setUserRoles(authRoles);
      if (mode === "edit" && authRoles.includes("safety-officer")) {
        setActive("safety");
      }
    }
  }, [authRoles, mode]);

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
      listPermitExecutors().catch(() => []),
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
          const isOperator = profile.roles.includes("permit-operator");
          const isReceiver =
            profile.roles.includes("permit-receiver") ||
            profile.roles.includes("tenant-owner") ||
            profile.roles.includes("tenant-admin");
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
          if ((isOperator || isReceiver) && !byId.has(profile.id)) {
            byId.set(profile.id, {
              id: profile.id,
              name: `${displayName} (you)`,
              email: profile.email ?? null,
              role: isOperator ? "Permit operator" : "Permit receiver",
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
            if (isOperator && !isReceiver) {
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
    sitesApi.list().then((rows) => {
      const active = rows.filter(inUse);
      setSites(active);
      setForm((current) => current.siteId || active.length !== 1 ? current : { ...current, siteId: active[0]!.id });
    }).catch(() => setSites([]));
    listTenantUsers().then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    if (!form.siteId) {
      setWorkLocations([]);
      return;
    }
    placeApi.listWorkLocations(form.siteId).then(setWorkLocations).catch(() => setWorkLocations([]));
  }, [form.siteId]);

  useEffect(() => {
    if (!form.workLocationId) {
      setApproverText("");
      return;
    }
    placeApi.getWorkLocation(form.workLocationId).then((detail) => {
      if (detail.approvers.userIds.length === 0) {
        setApproverText("No approver is set on this location or above it. Any permit approver may approve.");
        return;
      }
      const names = detail.approvers.userIds.map((id) => {
        const user = people.find((person) => person.id === id);
        return user ? (user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Approver") : "Approver";
      });
      setApproverText(detail.approvers.inheritedFrom ? `${names.join(", ")} (from a parent location)` : names.join(", "));
    }).catch(() => setApproverText(""));
  }, [form.workLocationId, people]);

  useEffect(() => {
    if (!form.siteId || !form.workLocationId) {
      setSiteAssets([]);
      return;
    }
    const locationId = form.workLocationId;
    placeApi.listAssets(form.siteId, locationId, true).then((rows) => {
      setSiteAssets(rows);
      const allowed = new Set(rows.map((row) => row.id));
      let stripped = false;
      setForm((current) => {
        if (current.workLocationId !== locationId) return current;
        const assetIds = current.assetIds.filter((id) => allowed.has(id));
        if (assetIds.length === current.assetIds.length) return current;
        stripped = true;
        return { ...current, assetIds };
      });
      if (stripped) setDirty(true);
    }).catch(() => setSiteAssets([]));
  }, [form.siteId, form.workLocationId]);

  useEffect(() => {
    const jobs: Promise<LototoProcedureListItem[]>[] = [];
    if (form.workLocationId) {
      jobs.push(listLototoProcedures({ workLocationId: form.workLocationId, published: true }).catch(() => []));
    }
    const targets = form.assetIds.length > 0 ? form.assetIds : form.machineryId ? [form.machineryId] : [];
    for (const id of targets) {
      jobs.push(
        listLototoProcedures(form.assetIds.length > 0 ? { assetId: id, published: true } : { machineryId: id, published: true }).catch(() => []),
      );
    }
    if (jobs.length === 0) {
      setMachineryLototo([]);
      return;
    }
    Promise.all(jobs).then((groups) => {
      const byId = new Map<string, LototoProcedureListItem>();
      for (const row of groups.flat()) byId.set(row.id, row);
      setMachineryLototo([...byId.values()]);
    });
  }, [form.assetIds, form.machineryId, form.workLocationId]);

  const placeSelectionKey = `${form.workLocationId}|${[...form.assetIds].sort().join(",")}`;
  useEffect(() => {
    if (masterDataLoading) return;
    if (placeSelectionRef.current === null) {
      placeSelectionRef.current = placeSelectionKey;
      return;
    }
    if (placeSelectionRef.current === placeSelectionKey) return;
    placeSelectionRef.current = placeSelectionKey;
    const permitTypeCode = permitTypes.find((type) => type.id === form.permitTypeId)?.code;
    const plan = placeHazardPlan({
      hazards,
      locations: workLocations,
      assets: siteAssets,
      workLocationId: form.workLocationId,
      assetIds: form.assetIds,
      permitTypeCode,
    });
    setPpeManualOff([]);
    setPpeManualOn([]);
    setDirty(true);
    setForm((current) => {
      const kept = new Map(
        current.hazards.filter((row) => row.hazardCategoryId).map((row) => [row.hazardCategoryId, row]),
      );
      const nextHazards = [...plan.defaultOn].map((id) => kept.get(id) ?? emptyPermitHazard(id));
      return {
        ...current,
        hazards: nextHazards.length > 0 ? nextHazards : [emptyPermitHazard()],
        ppe: ppeForHazards({
          hazardIds: plan.defaultOn,
          hazards,
          manualOff: [],
          manualOn: [],
          previous: current.ppe,
        }),
      };
    });
  }, [placeSelectionKey, masterDataLoading, hazards, workLocations, siteAssets, permitTypes, form.permitTypeId, form.workLocationId, form.assetIds]);

  useEffect(() => {
    if (!form.workLocationId) return;
    let cancelled = false;
    const applyDefaults = !form.gasReady;
    const previous = form.gasTesting;
    gasTestingApi.defaults(form.workLocationId, form.assetIds).then((rows) => {
      if (cancelled) return;
      const usable = rows.filter((row) => row.catalogueId);
      setGasBaselines(new Map(usable.map((row) => [row.catalogueId!, { minimum: row.minimum, maximum: row.maximum }])));
      const sourceName = (row: (typeof usable)[number]) =>
        row.minimumSource.name === row.maximumSource.name
          ? row.minimumSource.name
          : `${row.minimumSource.name} / ${row.maximumSource.name}`;
      if (!applyDefaults) {
        setForm((current) => {
          let changed = false;
          const gasTesting = current.gasTesting.map((item) => {
            if (item.sourceName || !item.gasTestingCatalogueId) return item;
            const row = usable.find((candidate) => candidate.catalogueId === item.gasTestingCatalogueId);
            if (!row) return item;
            changed = true;
            return { ...item, sourceName: sourceName(row) };
          });
          return changed ? { ...current, gasTesting } : current;
        });
        return;
      }
      const handAdded = previous.filter((item) => !item.gasTestingCatalogueId && item.parameter?.trim());
      const previousDefaults = previous.filter((item) => item.gasTestingCatalogueId);
      const removedByParameter = new Map(
        previousDefaults
          .filter((item) => item.removedReason?.trim())
          .map((item) => [item.parameter?.trim().toLowerCase() ?? "", item.removedReason]),
      );
      const nextDefaults = usable.map((row) => ({
        gasTestingCatalogueId: row.catalogueId!,
        parameter: row.parameter,
        unit: row.unit,
        minimum: row.minimum,
        maximum: row.maximum,
        removedReason: removedByParameter.get(row.parameter.trim().toLowerCase()) || undefined,
        sourceName: sourceName(row),
      }));
      if (previousDefaults.length > 0 || handAdded.length > 0) {
        const changes: string[] = [];
        const previousByParameter = new Map(previousDefaults.map((item) => [item.parameter?.trim().toLowerCase() ?? "", item]));
        for (const row of nextDefaults) {
          const old = previousByParameter.get(row.parameter.trim().toLowerCase());
          if (!old) {
            changes.push(`Added ${row.parameter} from ${row.sourceName}`);
          } else if (old.minimum !== row.minimum || old.maximum !== row.maximum) {
            const tightened = (old.minimum ?? row.minimum) <= row.minimum && (old.maximum ?? row.maximum) >= row.maximum;
            changes.push(
              tightened
                ? `Tightened ${row.parameter} to ${row.minimum}–${row.maximum} ${row.unit}`
                : `Updated ${row.parameter} to ${row.minimum}–${row.maximum} ${row.unit}`,
            );
          }
        }
        for (const old of previousDefaults) {
          const key = old.parameter?.trim().toLowerCase();
          if (key && !nextDefaults.some((row) => row.parameter.trim().toLowerCase() === key)) {
            changes.push(`Removed ${old.parameter}; it is no longer a default for this place`);
          }
        }
        if (changes.length > 0) setGasNotice(changes);
      }
      setForm((current) => {
        if (current.gasReady || current.workLocationId !== form.workLocationId) return current;
        return {
          ...current,
          gasReady: true,
          gasTestingRequired: nextDefaults.some((row) => !row.removedReason) || handAdded.length > 0 || current.gasTestingRequired,
          gasTesting: [...nextDefaults, ...handAdded],
        };
      });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [form.workLocationId, form.assetIds]);

  useEffect(() => {
    const ids = [...new Set(form.lototo.map((item) => item.procedureId).filter(Boolean))];
    ids.forEach((id) => {
      if (lototoDetails[id]) {
        return;
      }
      void getLototoProcedure(id)
        .then((detail) => setLototoDetails((prev) => ({ ...prev, [id]: detail })))
        .catch(() => undefined);
    });
  }, [form.lototo, lototoDetails]);

  useEffect(() => {
    if (initialDetail) {
      setForm(permitDetailToForm(initialDetail));
      setAttachments(initialDetail.attachments);
      setStatus(initialDetail.permit.status);
      setPermitId(initialDetail.permit.id);
      setRevision(initialDetail.permit.draftRevision);
      setBase(permitDetailToForm(initialDetail));
      setConflicts([]);
      setConflict(false);
    }
  }, [initialDetail]);

  /** Every edit by the person goes through here, so the editor knows what is unsaved. */
  const edit: typeof setForm = (update) => {
    setDirty(true);
    setForm(update);
  };

  /** What the permit already says, for the forms' "fill from permit" fields. */
  const prefillSources = (current: PermitFormState): Record<TemplatePrefillSource, string | number | undefined> => {
    const nameOf = (list: { id: string; name: string }[], id: string) => list.find((row) => row.id === id)?.name ?? "";
    const crew = current.executors
      .map((e) => executorOptions.find((o) => o.id === e.workforceUserId)?.name.replace(/ \(you\)$/, ""))
      .filter((name): name is string => Boolean(name));
    // A workstation often carries its location's name; say it once.
    const place = workLocations.find((row) => row.id === current.workLocationId);
    return {
      department: nameOf(departments, current.departmentId) || undefined,
      location: [place?.pathText || place?.name, current.exactSpot].filter(Boolean).join(" — ") || undefined,
      equipment: siteAssets.filter((row) => current.assetIds.includes(row.id)).map((row) => row.name).join(", ") || nameOf(machinery, current.machineryId) || undefined,
      "job-description": [current.title, current.workScope].filter((v) => v.trim()).join("\n\n") || undefined,
      "valid-from": current.plannedStartAt.slice(0, 10) || undefined,
      "valid-to": current.plannedEndAt.slice(0, 10) || undefined,
      "crew-names": crew.join(", ") || undefined,
      "crew-count": crew.length || undefined,
    };
  };

  /**
   * Fills the forms' "fill from permit" fields from the permit, so nothing is typed twice. Those fields
   * are not shown, so they always follow the permit; one the permit leaves empty is asked as usual.
   */
  const withPrefill = (current: PermitFormState): PermitFormState => {
    const sources = prefillSources(current);
    const formResponses = { ...current.formResponses };
    for (const template of applicableTemplates(templates, current.permitTypeId)) {
      const answers = { ...(formResponses[template.id] ?? {}) };
      for (const field of template.config?.sections.flatMap((section) => section.fields) ?? []) {
        const source = field.prefill ? sources[field.prefill] : undefined;
        if (source === undefined) continue;
        const value: FormAnswer = field.type === "number" ? Number(source) : String(source);
        if (typeof value === "number" && !Number.isFinite(value)) continue;
        answers[field.id] = value;
      }
      formResponses[template.id] = answers;
    }
    return { ...current, formResponses };
  };

  // Prefilled answers follow the permit and are saved with it.
  const prefilled = withPrefill(form);
  const fromPermit = new Set(
    (Object.entries(prefillSources(form)) as [TemplatePrefillSource, unknown][]).flatMap(([key, value]) => (value === undefined ? [] : [key])),
  );

  const persistDraft = async () => {
    const roles = authRoles.length > 0 ? authRoles : userRoles;
    const payload = formToSavePayload(prefilled, {
      executorOnly: shouldSaveExecutorPayload(roles),
      safetyApprovalOnly: shouldSaveSafetyApprovalOnly(roles),
      includeSafetyApproval:
        hasAnyRole(roles, ["safety-officer", "tenant-owner", "tenant-admin", "platform-admin"]) &&
        needsSafetyApproval(prefilled),
    });
    if (!shouldSaveSafetyApprovalOnly(roles)) {
      if (templatesLoaded) {
        // Answers for templates that no longer apply (the permit type changed) are dropped.
        const ids = new Set(applicableTemplates(templates, form.permitTypeId).map((t) => t.id));
        payload.formResponses = payload.formResponses?.filter((response) => ids.has(response.templateId));
      } else {
        delete payload.formResponses;
      }
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
      if (created.permit.createdBy) {
        setReceiverId(created.permit.createdBy);
      }
      // Update the address only: a router navigation would remount the editor.
      window.history.replaceState(null, "", `/permits/${id}/edit`);
    }

    // Create stores only type, title and scope; this save stores the rest of the form.
    try {
      const saved = await savePermitDraft(id, { ...payload, expectedRevision: baseRevision });
      setGasNotice(saved.gasChanges && saved.gasChanges.length > 0 ? saved.gasChanges : null);
      setRevision(saved.permit.draftRevision);
      setDraftHolder(parseDraftHolder(saved.permit.draftHolder));
      setDraftHeldBy(saved.permit.draftHeldBy ?? saved.permit.createdBy ?? null);
      setReturnReason(saved.permit.draftReturnReason ?? "");
      // What the server now holds, exactly: the ancestor for any later merge.
      setBase(permitDetailToForm(saved));
      setConflict(false);
      return { id, revision: saved.permit.draftRevision };
    } catch (error) {
      if (isRevisionConflict(error)) {
        // Merge in the other person's save: their unrelated changes are kept, this person's are kept,
        // and values both changed are listed for a choice. Saving again stays an explicit step.
        const latest = await getPermit(id);
        const savedForm = permitDetailToForm(latest);
        const result = mergeAfterConflict(base, form, savedForm);
        setForm(result.merged);
        setBase(savedForm);
        setConflicts(result.conflicts);
        setRevision(latest.permit.draftRevision);
        setConflict(true);
      }
      throw error;
    }
  };

  /** The submit error for one field, shown under it. */
  const fieldError = (id: string) => errors.find((e) => e.href === `#${id}`)?.message;

  /** The person's choice for one value both people changed. */
  const chooseConflict = (item: FieldConflict, keep: "saved" | "yours") => {
    edit((current) => resolveConflict(current, item, keep));
    setConflicts((current) => current.filter((c) => c.key !== item.key));
  };
  const FIELD_LABELS: Record<string, string> = {
    permitTypeId: "Permit type",
    title: "Title",
    workScope: "Work scope",
    emergencyPhone: "Emergency phone",
    plantId: "Plant",
    departmentId: "Department",
    locationId: "Location",
    workstationId: "Workstation",
    machineryId: "Equipment",
    plannedStartAt: "Planned start",
    plannedEndAt: "Planned end",
    hazards: "Hazards",
    ppe: "PPE",
    lototoRequired: "LOTOTO required",
    lototo: "LOTOTO plans",
    gasTestingRequired: "Gas testing required",
    gasTesting: "Gas tests",
    siteNotes: "Notes",
    executors: "Executors and crew",
    viewers: "Viewers",
    safetyOfficers: "Safety officers",
    safetyApprovalComment: "Safety Approval comments",
    safetyApprovalSignedName: "Safety Approval signed name",
  };
  const conflictLabel = (key: string) => {
    const [kind, a, b] = key.split(":");
    if (kind === "field") return FIELD_LABELS[a] ?? a;
    const template = templates.find((t) => t.id === a);
    const field = template?.config?.sections.flatMap((section) => section.fields).find((f) => f.id === b);
    return `${template?.name ?? "Form"}: ${field?.label ?? b}`;
  };
  const describeValue = (value: unknown): string => {
    if (value === undefined || value === null || value === "") return "empty";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length === 0 ? "none" : typeof value[0] === "string" ? value.join(", ") : `${value.length} item${value.length === 1 ? "" : "s"}`;
    if (typeof value === "object") return (value as { name?: string }).name ?? JSON.stringify(value);
    const text = String(value);
    const named = [...permitTypes, ...plants, ...departments, ...locations, ...workstations, ...machinery].find((row) => row.id === text);
    return named?.name ?? (text === "yes" ? "Yes" : text === "no" ? "No" : text === "na" ? "N/A" : text);
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
      edit({
        ...copy,
        plannedStartAt: "",
        plannedEndAt: "",
        formResponses: {},
        safetyApprovalComment: "",
        safetyApprovalSignedName: "",
        receiverSiteVisited: false,
        executorSiteVisited: false,
        safetyOfficerSiteVisited: false,
        currentStep: 0,
      });
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
  const sodExecutorOptions = executorOptions;
  const isExecutor = shouldSaveExecutorPayload(userRoles);
  const privilegedEditor = hasAnyRole(userRoles, ["tenant-owner", "tenant-admin", "platform-admin"]);
  const assignedExecutor = form.executors.some((row) => row.workforceUserId && row.workforceUserId === authProfile?.id);
  const primaryExecutorId = form.executors.find((e) => e.isPrimary)?.workforceUserId || form.executors[0]?.workforceUserId || "";
  const selfOperator = Boolean(authProfile?.id && primaryExecutorId === authProfile.id);
  const hasSafetyOfficer = needsSafetyApproval(form);
  const nextHold = nextHandoffTarget(draftHolder, hasSafetyOfficer);
  const returnHold = returnHandoffTarget(draftHolder, hasSafetyOfficer);
  const effectiveHeldBy = draftHeldBy ?? receiverId ?? (mode === "create" ? authProfile?.id : null);
  const isCurrentHolder = Boolean(authProfile?.id && effectiveHeldBy === authProfile.id) || privilegedEditor;
  const editable = (step: number) => {
    if (isReadOnly) return false;
    if (privilegedEditor) return true;
    if (!stepsEditableForHolder(draftHolder).includes(step)) return false;
    if (draftHolder === "operator") return assignedExecutor;
    if (draftHolder === "safety_officer") return hasAnyRole(userRoles, ["safety-officer"]);
    return canRoleEditWizardStep(userRoles, step);
  };
  const soAssignable =
    !isReadOnly &&
    hasAnyRole(userRoles, [
      "permit-receiver",
      "permit-operator",
      "permit-approver",
      "tenant-owner",
      "tenant-admin",
      "platform-admin",
    ]);
  const safetyEditable =
    editable(5) &&
    Boolean(authProfile?.id) &&
    (hasAnyRole(userRoles, ["tenant-owner", "tenant-admin", "platform-admin"]) ||
      form.safetyOfficers.some((row) => row.workforceUserId === authProfile?.id));
  const missing: Record<PermitEditorSectionId, string[]> = {
    work: validateStep(prefilled, 0),
    place: validateStep(prefilled, 1),
    site: validateStep(prefilled, 2, forms, machinery),
    crew: validateStep(prefilled, 3),
    forms: validateStep(prefilled, 4, forms),
    safety: validateStep(prefilled, 5),
    review: [],
  };
  const handoffAtEndOfSiteAssessment = active !== "site" || siteSafetyStep === "notes";
  const showHandoff =
    isEditablePermitStatus(status) &&
    Boolean(nextHold) &&
    isCurrentHolder &&
    handoffAtEndOfSiteAssessment &&
    handoffSectionFor(draftHolder) === active &&
    (draftHolder === "receiver"
      ? missing.work.length + missing.place.length === 0
      : draftHolder === "operator"
        ? missing.site.length + missing.crew.length + missing.forms.length === 0
        : draftHolder === "safety_officer"
          ? missing.safety.length === 0
          : false);
  const showReturn =
    isEditablePermitStatus(status) && Boolean(returnHold) && isCurrentHolder && returnSectionFor(draftHolder) === active;

  // Leaving with unsaved changes asks first: tab close and in-app links alike.
  useLeaveGuard(dirty);

  const visibleSections = editorSectionsFor(prefilled);
  const reviewSections = visibleSections.filter((section) => section.id !== "review");
  const activeIndex = Math.max(0, visibleSections.findIndex((section) => section.id === active));
  useEffect(() => {
    if (active === "safety" && !needsSafetyApproval(form)) {
      setActive("review");
    }
  }, [active, form.safetyOfficers]);
  const goTo = (id: PermitEditorSectionId) => {
    setActive(id);
    if (id === "site") {
      const siteGaps = missing.site.join(" ");
      setSiteSafetyStep(
        siteGaps.includes("asset")
          ? "place"
          : siteGaps.includes("hazard")
            ? "hazards"
            : siteGaps.includes("LOTOTO")
              ? "lototo"
              : siteGaps.includes("gas testing")
                ? "gas"
                : "verification",
      );
    }
    const step = PERMIT_EDITOR_SECTIONS.find((section) => section.id === id)!.steps[0];
    setForm((current) => ({ ...current, currentStep: step }));
    window.scrollTo({ top: 0 });
  };
  const sectionEditable = (id: PermitEditorSectionId) => id === "review" || editable(PERMIT_EDITOR_SECTIONS.find((section) => section.id === id)!.steps[0]);
  const errorsFor = (id: PermitEditorSectionId) =>
    missing[id].map((message) => {
      // A form's error goes to that form, where the unanswered questions are marked.
      const template = id === "forms" ? forms.find((t) => message.startsWith(`${t.name}:`)) : undefined;
      return { message, section: id, href: `#${template ? `form-${template.id}` : (ERROR_FIELDS[message] ?? `section-${id}`)}` };
    });
  /** Next checks only this step, and only when this person fills it in. */
  const handleNext = () => {
    if (active === "site") {
      const safetyIndex = SITE_SAFETY_STEPS.findIndex((step) => step.id === siteSafetyStep);
      if (safetyIndex < SITE_SAFETY_STEPS.length - 1) {
        setSiteSafetyStep(SITE_SAFETY_STEPS[safetyIndex + 1].id);
        setErrors([]);
        return;
      }
    }
    const stepErrors = sectionEditable(active) ? errorsFor(active) : [];
    setErrors(stepErrors);
    if (stepErrors.length) {
      requestAnimationFrame(() => document.getElementById("validation-summary")?.focus());
      return;
    }
    goTo(visibleSections[activeIndex + 1].id);
  };
  const handleBack = () => {
    if (active === "site") {
      const safetyIndex = SITE_SAFETY_STEPS.findIndex((step) => step.id === siteSafetyStep);
      if (safetyIndex > 0) {
        setSiteSafetyStep(SITE_SAFETY_STEPS[safetyIndex - 1].id);
        setErrors([]);
        return;
      }
    }
    goTo(visibleSections[activeIndex - 1].id);
  };

  const applyHandoffDetail = (detail: PermitDetail, message: string) => {
    setRevision(detail.permit.draftRevision);
    setDraftHolder(parseDraftHolder(detail.permit.draftHolder));
    setDraftHeldBy(detail.permit.draftHeldBy ?? detail.permit.createdBy ?? null);
    setReturnReason(detail.permit.draftReturnReason ?? "");
    setShowReturnForm(false);
    setReturnReasonDraft("");
    setHandoffNotice(message);
    setDirty(false);
  };

  const holderSectionsComplete = () => {
    if (draftHolder === "receiver") return missing.work.length + missing.place.length === 0;
    if (draftHolder === "operator") return missing.site.length + missing.crew.length + missing.forms.length === 0;
    if (draftHolder === "safety_officer") return missing.safety.length === 0;
    return true;
  };

  const handleHandoff = async () => {
    if (!nextHold) return;
    const stepErrors = holderSectionsComplete() ? [] : [
      ...(draftHolder === "receiver" ? [...errorsFor("work"), ...errorsFor("place")] : []),
      ...(draftHolder === "operator" ? [...errorsFor("site"), ...errorsFor("crew"), ...errorsFor("forms")] : []),
      ...(draftHolder === "safety_officer" ? errorsFor("safety") : []),
    ];
    setErrors(stepErrors);
    if (stepErrors.length) {
      requestAnimationFrame(() => document.getElementById("validation-summary")?.focus());
      return;
    }
    const label = handoffButtonLabel(nextHold, selfOperator);
    const nextName = nextHold === "operator" ? personName(primaryExecutorId) : nextHold === "safety_officer" ? "the assigned safety officer" : "the permit receiver";
    if (!(await confirmAction(`${label}? ${selfOperator && nextHold === "operator" ? "You will continue as operator on this permit." : `${nextName} will be notified. Your sections will lock.`}`))) {
      return;
    }
    setIsSaving(true);
    setApiError(null);
    try {
      const saved = await persistDraft();
      const result = await handoffPermitDraft(saved.id, { to: nextHold, expectedRevision: saved.revision });
      applyHandoffDetail(
        result,
        selfOperator && nextHold === "operator"
          ? "You now hold the draft as operator. Fill Site safety, Crew, and Forms."
          : `Your part is done. ${nextName} has been notified.`,
      );
      if (nextHold === "operator") setActive("site");
      else if (nextHold === "safety_officer") setActive("safety");
      else setActive("review");
    } catch (error) {
      if (error instanceof ApiError) {
        const details = Array.isArray(error.details)
          ? error.details.filter((detail): detail is string => typeof detail === "string")
          : [];
        setApiError([error.message, ...details.map((detail) => `- ${detail}`)].join("\n"));
      } else {
        setApiError("Could not hand over the draft");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReturnDraft = async () => {
    if (!returnHold) return;
    const reason = returnReasonDraft.trim();
    if (!reason) {
      setApiError("Why return is required");
      return;
    }
    setIsSaving(true);
    setApiError(null);
    try {
      if (dirty) {
        await persistDraft();
      }
      const result = await returnPermitDraft(permitId!, revision, reason);
      applyHandoffDetail(
        result,
        `Draft returned. ${holderStageLabel(parseDraftHolder(result.permit.draftHolder))} holds it now.`,
      );
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : "Could not return the draft");
    } finally {
      setIsSaving(false);
    }
  };

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
    const allErrors = visibleSections.flatMap((section) => errorsFor(section.id));
    setErrors(allErrors);
    if (allErrors.length > 0) {
      // Open the first step with something to fix; the summary links to the rest.
      setActive(allErrors[0].section);
      requestAnimationFrame(() => document.getElementById("validation-summary")?.focus());
      return;
    }
    if (!(await confirmAction(isResubmit ? "Resubmit this permit for approval?" : "Submit this permit for approval?"))) {
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

  const personName = (id: string) =>
    executorOptions.find((o) => o.id === id)?.name ?? (id ? "Person no longer available" : "");
  const hazardRows = form.hazards.filter((h) => h.hazardCategoryId);
  const permitSafetyControls = hazardRows.flatMap((hazard) => {
    const catalogue = hazards.find((row) => row.id === hazard.hazardCategoryId);
    return permitControlLines(catalogue?.controls, hazard.extraControls, hazard.omittedControls).map((control) => ({
      hazard: catalogue?.name ?? "Hazard",
      control,
    }));
  });
  const permitSafetyRisks = hazardRows.flatMap((hazard) => {
    const catalogue = hazards.find((row) => row.id === hazard.hazardCategoryId);
    const lines = [
      ...catalogueLinesForPermit(catalogue?.risks, hazard.omittedRisks),
      ...(hazard.extraRisks ?? []),
    ].map((line) => line.trim()).filter(Boolean);
    return lines.map((risk) => ({ hazard: catalogue?.name ?? "Hazard", risk }));
  });
  const permitTypeCode = permitTypes.find((type) => type.id === form.permitTypeId)?.code;
  const selectedWorkLocation = workLocations.find((row) => row.id === form.workLocationId);
  const selectedHazardIds = new Set(hazardRows.map((h) => h.hazardCategoryId));
  const hazardPlan = placeHazardPlan({
    hazards,
    locations: workLocations,
    assets: siteAssets,
    workLocationId: form.workLocationId,
    assetIds: form.assetIds,
    permitTypeCode,
  });
  const offeredHazards = hazards.filter(
    (hazard) => hazardPlan.listedIds.has(hazard.id) || selectedHazardIds.has(hazard.id),
  );
  const ppeRows = form.ppe.filter((p) => p.ppeCatalogueId);
  const crewRows = form.executors.filter((e) => (e.workforceUserId ?? "").trim());
  const saveLabel = isExecutor ? "Save preparation" : "Save draft";

  const placeEditable = editable(1);
  const siteEditable = editable(2);
  const crewEditable = editable(3);
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
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Permit steps" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-2 flex items-center justify-between lg:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Permit setup</p>
            <p className="text-xs text-muted-foreground lg:mt-1">Step {activeIndex + 1} of {visibleSections.length}</p>
          </div>
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-2">
            {visibleSections.map((section, index) => {
              const left = missing[section.id].length;
              const current = section.id === active;
              const complete = !left && section.id !== "review";
              return (
                <li key={section.id} className="w-40 shrink-0 lg:w-auto lg:shrink">
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    onClick={() => goTo(section.id)}
                    className={cn(
                      "group flex h-13 min-h-13 w-full items-center gap-2.5 rounded-lg border px-3 text-left text-xs transition-colors lg:border-transparent lg:text-sm",
                      current
                        ? "border-primary bg-primary text-primary-foreground shadow-sm lg:border-primary"
                        : "border-border bg-card hover:bg-muted lg:bg-transparent",
                    )}
                  >
                    <span className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full font-mono text-[10px]",
                      current ? "bg-primary-foreground/15 text-primary-foreground" : complete ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground",
                    )}>
                      {complete ? <Check className="size-3.5" aria-hidden /> : String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="line-clamp-2 min-w-0 whitespace-normal font-semibold leading-tight lg:flex-1">{section.label}</span>
                    {left ? <span className={cn("hidden text-[11px] lg:inline", current ? "text-primary-foreground/80" : "text-amber-700")}>{left} to do</span> : null}
                    {complete ? <span className="hidden text-[10px] font-medium text-emerald-800 lg:inline">Ready</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 hidden rounded-lg border border-border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground lg:block">
            <p className="font-semibold text-foreground">Drafts are not authorization</p>
            <p>Work must not start until the permit is approved and site controls are verified.</p>
          </div>
        </nav>
        <div className="grid min-w-0 content-start gap-5">

      {status === "draft" || status === "deferred" || status === "rejected" ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <p>
            Held by {effectiveHeldBy ? personName(effectiveHeldBy) : holderStageLabel(draftHolder)} ({holderStageLabel(draftHolder)}) — {holderNextWork(draftHolder)}.
          </p>
          {returnReason.trim() ? (
            <p className="mt-1">
              Why return: {returnReason.trim()}
            </p>
          ) : null}
          {handoffNotice ? <p className="mt-1 font-medium text-(--status-success)">{handoffNotice}</p> : null}
          {gasNotice && gasNotice.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium">Gas tests were recalculated.</p>
              <ul className="mt-1 list-disc pl-5">
                {gasNotice.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "draft" ? <DraftBanner /> : null}

      {active === "work" && mode === "create" && !permitId && recentPermits.length > 0 && editable(0) ? (
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


      <ValidationSummary errors={errors} onGo={(error) => error.section && setActive(error.section)} />
      {apiError ? (
        <div role="alert" className="whitespace-pre-line rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {apiError}
          {conflict ? (
            <div className="mt-2 grid gap-3 text-foreground">
              <p>
                Another person saved this permit after you opened it. Their changes to other fields are now in the form below, and yours are kept.
                {conflicts.length
                  ? ` You both changed ${conflicts.length === 1 ? "one value" : `${conflicts.length} values`}: choose which to keep, then ${saveLabel.toLowerCase()} again.`
                  : ` ${saveLabel} again to save the combined permit.`}{" "}
                Submit stays unavailable until then.
              </p>
              {conflicts.length ? (
                <ul className="grid gap-2" aria-label="Values you both changed">
                  {conflicts.map((item) => (
                    <li key={item.key} className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="grid gap-0.5">
                        <p className="font-medium">{conflictLabel(item.key)}</p>
                        <p className="text-muted-foreground">
                          Saved: <span className="text-foreground">{describeValue(item.saved)}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Yours: <span className="text-foreground">{describeValue(item.yours)}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => chooseConflict(item, "yours")}>
                          Keep mine
                        </Button>
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => chooseConflict(item, "saved")}>
                          Use saved
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {active === "work" ? (
      <EditorSection id="work" title="Work" owner="Permit receiver" editable={editable(0)} left={missing.work.length} note={!editable(0) ? "Read-only until the current holder returns the draft." : undefined}>
        <div className="grid gap-2">
          <p id="permit-type-label" className="text-sm font-medium">
            Permit type
          </p>
          {masterDataLoading ? (
            <p className="text-sm text-muted-foreground">Loading permit types…</p>
          ) : permitTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No permit types yet. An administrator adds them under Organisation, Permit types.</p>
          ) : (
            <div role="radiogroup" aria-labelledby="permit-type-label" className="grid gap-x-8 sm:grid-cols-2">
              {permitTypes.map((type) => {
                const selected = form.permitTypeId === type.id;
                return (
                  <label
                    key={type.id}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 border-b border-border px-2 py-2.5 text-sm transition-colors hover:bg-muted/60 focus-within:bg-muted/60 has-disabled:cursor-not-allowed has-disabled:opacity-60",
                      selected && "bg-primary/5 font-semibold",
                    )}
                  >
                    <input
                      type="radio"
                      name="permitTypeId"
                      value={type.id}
                      checked={selected}
                      disabled={!editable(0)}
                      onChange={() => {
                        const plan = placeHazardPlan({
                          hazards,
                          locations: workLocations,
                          assets: siteAssets,
                          workLocationId: form.workLocationId,
                          assetIds: form.assetIds,
                          permitTypeCode: type.code,
                        });
                        const kept = form.hazards.filter((row) => {
                          if (!row.hazardCategoryId) return true;
                          if (plan.defaultOn.has(row.hazardCategoryId)) return true;
                          const catalogue = hazards.find((hazard) => hazard.id === row.hazardCategoryId);
                          return hazardFitsPermitType(catalogue?.permitTypeCodes, type.code);
                        });
                        edit({
                          ...form,
                          permitTypeId: type.id,
                          hazards: kept.length ? kept : [emptyPermitHazard()],
                        });
                      }}
                      className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-border" style={type.color ? { backgroundColor: type.color } : undefined} />
                    <span className="min-w-0 flex-1">{type.name}</span>
                    {type.code ? <span className="shrink-0 font-mono text-xs font-normal text-muted-foreground">{type.code}</span> : null}
                  </label>
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
        <FormField label="Title" htmlFor="title" error={fieldError("title")} hint={titleEdited ? undefined : "Suggested from the scope. Change it if it does not read well."}>
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
        <FormField
          label="Emergency phone"
          htmlFor="emergencyPhone"
          hint="Optional. Who to call if something goes wrong on this job."
        >
          <input
            id="emergencyPhone"
            type="tel"
            autoComplete="tel"
            className={fieldClassName}
            value={form.emergencyPhone}
            disabled={!editable(0)}
            onChange={(e) => edit({ ...form, emergencyPhone: e.target.value })}
          />
        </FormField>
      </EditorSection>
      ) : null}

      {active === "place" ? (
      <EditorSection id="place" title="Place and schedule" owner="Permit receiver" editable={placeEditable} left={missing.place.length} note={!placeEditable ? "Read-only until the current holder returns the draft." : undefined}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Site" htmlFor="siteId" error={fieldError("siteId")}>
            <MasterDataSelect
              id="siteId"
              value={form.siteId}
              options={sites}
              disabled={!placeEditable}
              placeholder="Select site"
              onChange={(siteId) => edit((current) => ({
                ...current,
                siteId,
                workLocationId: "",
                assetIds: [],
                gasReady: false,
                gasTesting: [],
              }))}
            />
          </FormField>
          <FormField label="Exact spot" htmlFor="exactSpot" hint="Optional. A spot inside the work location.">
            <input
              id="exactSpot"
              className={fieldClassName}
              value={form.exactSpot}
              disabled={!placeEditable}
              onChange={(e) => edit((current) => ({ ...current, exactSpot: e.target.value }))}
            />
          </FormField>
          <div className="md:col-span-2 grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-sm font-semibold" htmlFor="work-location-search">Work location</label>
              <div className="relative w-full sm:w-72">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="work-location-search"
                  className={cn(fieldClassName, "h-10 pl-9")}
                  value={locationQuery}
                  disabled={!placeEditable || !form.siteId}
                  placeholder={form.siteId ? "Search the location path" : "Select a site first"}
                  onChange={(e) => setLocationQuery(e.target.value)}
                />
              </div>
            </div>
            {form.workLocationId ? (
              <p aria-live="polite" className="flex min-h-10 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 text-sm font-medium">
                <Check aria-hidden className="size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">Selected:</span>
                <span className="min-w-0 truncate">{selectedWorkLocation?.pathText || selectedWorkLocation?.name || "Selected work location"}</span>
              </p>
            ) : null}
            <div className={cn("max-h-48 overflow-y-auto rounded-md border border-border", fieldError("workLocationId") && "border-destructive")}>
              {workLocations
                .filter((row) => !locationQuery.trim() || `${row.pathText} ${row.name}`.toLowerCase().includes(locationQuery.trim().toLowerCase()))
                .map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    disabled={!placeEditable}
                    aria-pressed={form.workLocationId === row.id}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted",
                      form.workLocationId === row.id && "bg-primary/10 font-semibold text-foreground ring-1 ring-inset ring-primary/50",
                    )}
                    onClick={() => edit((current) => ({
                      ...current,
                      workLocationId: row.id,
                      assetIds: [],
                      gasReady: false,
                      gasTesting: [],
                      gasTestingRequired: false,
                    }))}
                  >
                    <span>{row.pathText || row.name}</span>
                    {form.workLocationId === row.id ? <Check className="size-4 shrink-0 text-primary" aria-label="Selected" /> : null}
                  </button>
                ))}
            </div>
            {fieldError("workLocationId") ? <p className="text-sm text-destructive">{fieldError("workLocationId")}</p> : null}
          </div>
          <div className="md:col-span-2 grid gap-1.5 text-sm">
            <span className="font-medium">Approvers</span>
            <p className="text-muted-foreground">{form.workLocationId ? approverText || "Loading approvers…" : "Choose a work location to see who can approve."}</p>
          </div>
          <FormField
            label="Primary executor"
            htmlFor="primary-executor" error={fieldError("primary-executor")}
            hint="Permit operators or permit receivers (including you). They fill Site safety, Crew and Forms."
          >
            <PersonSelect
              id="primary-executor"
              value={form.executors.find((e) => e.isPrimary)?.workforceUserId ?? form.executors[0]?.workforceUserId ?? ""}
              disabled={!placeEditable || masterDataLoading}
              options={sodExecutorOptions}
              placeholder="Select executor"
              internalGroupLabel="Internal — Operators and receivers"
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
                  className="min-h-11 rounded-full border border-input bg-input-fill px-3.5 text-sm hover:bg-muted aria-pressed:border-2 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:font-semibold"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Planned start" htmlFor="plannedStartAt" error={fieldError("plannedStartAt")}>
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
            <FormField label="Planned end" htmlFor="plannedEndAt" error={fieldError("plannedEndAt")} hint={form.plannedStartAt ? "Must be after planned start" : undefined}>
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
      ) : null}

      {active === "site" ? (
      <EditorSection
        id="site"
        title="Site safety"
        owner="Permit operator"
        editable={siteEditable}
        left={missing.site.length}
        note={!siteEditable ? "Read-only until the operator holds the draft (or returns it)." : "Complete each safety area. Hazard-linked risks and controls stay with their hazard."}
      >
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Safety assessment</p>
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Step {SITE_SAFETY_STEPS.findIndex((step) => step.id === siteSafetyStep) + 1} of {SITE_SAFETY_STEPS.length}
              {" · "}{hazardRows.length} hazard{hazardRows.length === 1 ? "" : "s"} · {ppeRows.length} PPE item{ppeRows.length === 1 ? "" : "s"}
              {form.lototoRequired ? " · LOTOTO required" : ""}
              {form.gasTestingRequired ? " · Gas test required" : ""}
            </p>
          </div>
          <nav aria-label="Site safety sections" className="flex gap-1 overflow-x-auto border-b border-border">
            {SITE_SAFETY_STEPS.map((step, index) => {
              const selected = siteSafetyStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-current={selected ? "step" : undefined}
                  aria-label={`${step.label}, step ${index + 1} of ${SITE_SAFETY_STEPS.length}`}
                  onClick={() => setSiteSafetyStep(step.id)}
                  className={cn(
                    "relative flex min-h-9 shrink-0 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent sm:px-3 sm:text-sm",
                    selected ? "text-primary after:bg-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("font-mono text-[10px]", selected ? "text-primary" : "text-muted-foreground/70")}>{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">{step.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        {siteSafetyStep === "place" ? (
        <div className="grid gap-5">
        <div className="grid gap-1.5 text-sm">
          <span className="font-medium">Place</span>
          <p className="text-muted-foreground">
            {(() => {
              const place = workLocations.find((row) => row.id === form.workLocationId);
              const site = sites.find((row) => row.id === form.siteId);
              return [site?.name, place?.pathText || place?.name, form.exactSpot].filter(Boolean).join(" — ") || "The receiver has not set a place yet.";
            })()}
          </p>
          {siteEditable ? <p className="text-xs text-muted-foreground">Wrong place? Return the draft with a reason so the receiver can change it.</p> : null}
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Assets</h3>
          {fieldError("assetIds") ? <p className="text-sm text-destructive">{fieldError("assetIds")}</p> : null}
          {siteAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assets are recorded at this work location.</p>
          ) : (
            <div className="grid gap-1">
              {siteAssets.map((asset) => (
                <label key={asset.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.assetIds.includes(asset.id)}
                    disabled={!siteEditable}
                    onChange={() => edit((current) => {
                      const selected = current.assetIds.includes(asset.id);
                      return {
                        ...current,
                        assetIds: selected ? current.assetIds.filter((id) => id !== asset.id) : [...current.assetIds, asset.id],
                        gasReady: false,
                        lototo: selected ? current.lototo : current.lototo,
                      };
                    })}
                  />
                  {asset.tag} — {asset.name}
                </label>
              ))}
            </div>
          )}
        </div>
        </div>
        ) : null}

        {siteSafetyStep === "hazards" ? (
        <div className="grid gap-2">
          <ChipPicker
            label="Hazards"
            options={offeredHazards.map((hazard) => ({
              id: hazard.id,
              name: hazard.code ? `${hazard.name} (${hazard.code})` : hazard.name,
              hint: originLabel(hazardPlan.origin.get(hazard.id)),
            }))}
            selected={hazardRows.map((h) => h.hazardCategoryId)}
            disabled={!siteEditable || masterDataLoading}
            selectionStyle="row"
            empty={
              form.permitTypeId
                ? "No hazards for this permit type, work location, or selected assets."
                : undefined
            }
            onToggle={(hazardCategoryId) => {
              void (async () => {
                const selected = form.hazards.some((row) => row.hazardCategoryId === hazardCategoryId);
                if (selected && hazardPlan.defaultOn.has(hazardCategoryId)) {
                  const where = hazardPlan.origin.get(hazardCategoryId) === "asset" ? "a selected asset" : "the selected work location";
                  if (!(await confirmAction(`This hazard is configured for ${where}. Turning it off matters for this permit. Turn it off?`))) return;
                }
                const rows = form.hazards.filter((row) => row.hazardCategoryId);
                const nextRows = selected
                  ? rows.filter((row) => row.hazardCategoryId !== hazardCategoryId)
                  : [...rows, emptyPermitHazard(hazardCategoryId)];
                const nextIds = nextRows.map((row) => row.hazardCategoryId);
                const linked = linkedPpeIds(nextIds, hazards);
                const added = new Set(hazards.find((row) => row.id === hazardCategoryId)?.ppeIds ?? []);
                const nextOn = selected ? ppeManualOn.filter((id) => linked.has(id)) : ppeManualOn;
                const nextOff = selected ? ppeManualOff : ppeManualOff.filter((id) => !added.has(id));
                setPpeManualOn(nextOn);
                setPpeManualOff(nextOff);
                edit((current) => ({
                  ...current,
                  hazards: nextRows.length > 0 ? nextRows : [emptyPermitHazard()],
                  ppe: ppeForHazards({
                    hazardIds: nextIds,
                    hazards,
                    manualOff: nextOff,
                    manualOn: nextOn,
                    previous: current.ppe,
                  }),
                }));
              })();
            }}
          />
          {hazardRows.map((hazard) => {
            const catalogue = hazards.find((h) => h.id === hazard.hazardCategoryId);
            const name = catalogue?.name ?? "Hazard no longer offered";
            return (
              <div key={hazard.hazardCategoryId} className="grid gap-3 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium">
                    {name}
                    {catalogue?.code ? ` (${catalogue.code})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {catalogue?.category || "Uncategorised"}
                    {catalogue?.severity ? ` · ${catalogue.severity}` : ""}
                  </p>
                  {catalogue?.description ? <p className="mt-1 whitespace-pre-wrap text-sm">{catalogue.description}</p> : null}
                  {originLabel(hazardPlan.origin.get(hazard.hazardCategoryId)) ? (
                    <p className="mt-1 text-xs text-muted-foreground">{originLabel(hazardPlan.origin.get(hazard.hazardCategoryId))}</p>
                  ) : null}
                </div>
                <ConfiguredList
                  title="Risks"
                  empty="No risks configured for this hazard."
                  items={catalogue?.risks ?? []}
                  omitted={hazard.omittedRisks ?? []}
                  disabled={!siteEditable}
                  onOmit={(omittedRisks) =>
                    edit((current) => ({
                      ...current,
                      hazards: current.hazards.map((h) =>
                        h.hazardCategoryId === hazard.hazardCategoryId ? { ...h, omittedRisks } : h,
                      ),
                    }))
                  }
                />
                <ExtraStringList
                  label="Additional risks"
                  values={hazard.extraRisks ?? []}
                  disabled={!siteEditable}
                  onChange={(extraRisks) =>
                    edit((current) => ({
                      ...current,
                      hazards: current.hazards.map((h) =>
                        h.hazardCategoryId === hazard.hazardCategoryId ? { ...h, extraRisks } : h,
                      ),
                    }))
                  }
                />
                <ConfiguredList
                  title="Consequences"
                  empty="No consequences configured for this hazard."
                  items={catalogue?.consequences ?? []}
                  omitted={hazard.omittedConsequences ?? []}
                  disabled={!siteEditable}
                  onOmit={(omittedConsequences) =>
                    edit((current) => ({
                      ...current,
                      hazards: current.hazards.map((h) =>
                        h.hazardCategoryId === hazard.hazardCategoryId ? { ...h, omittedConsequences } : h,
                      ),
                    }))
                  }
                />
                <ExtraStringList
                  label="Additional consequences"
                  values={hazard.extraConsequences ?? []}
                  disabled={!siteEditable}
                  onChange={(extraConsequences) =>
                    edit((current) => ({
                      ...current,
                      hazards: current.hazards.map((h) =>
                        h.hazardCategoryId === hazard.hazardCategoryId ? { ...h, extraConsequences } : h,
                      ),
                    }))
                  }
                />
                <ConfiguredList
                  title="Safety / controls"
                  empty="No controls configured for this hazard."
                  items={catalogue?.controls ?? []}
                  omitted={hazard.omittedControls ?? []}
                  disabled={!siteEditable}
                  onOmit={(omittedControls) =>
                    edit((current) => ({
                      ...current,
                      hazards: current.hazards.map((h) =>
                        h.hazardCategoryId === hazard.hazardCategoryId ? { ...h, omittedControls } : h,
                      ),
                    }))
                  }
                />
                <ExtraStringList
                  label="Additional controls"
                  values={hazard.extraControls ?? []}
                  disabled={!siteEditable}
                  onChange={(extraControls) =>
                    edit((current) => ({
                      ...current,
                      hazards: current.hazards.map((h) =>
                        h.hazardCategoryId === hazard.hazardCategoryId ? { ...h, extraControls } : h,
                      ),
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
        ) : null}

        {siteSafetyStep === "ppe" ? (
        <div className="grid gap-2">
          <ChipPicker
            label="PPE"
            options={ppeItems.map((item) => ({
              id: item.id,
              name: item.code ? `${item.name} (${item.code})` : item.name,
            }))}
            selected={ppeRows.map((p) => p.ppeCatalogueId)}
            disabled={!siteEditable || masterDataLoading}
            selectionStyle="row"
            quantityFor={(ppeCatalogueId) => ppeRows.find((p) => p.ppeCatalogueId === ppeCatalogueId)?.quantity}
            onQuantityChange={(ppeCatalogueId, quantity) =>
              edit((current) => ({
                ...current,
                ppe: current.ppe.map((p) =>
                  p.ppeCatalogueId === ppeCatalogueId ? { ...p, quantity } : p,
                ),
              }))
            }
            onToggle={(ppeCatalogueId) => {
              void (async () => {
                const rows = form.ppe.filter((row) => row.ppeCatalogueId);
                const on = rows.some((row) => row.ppeCatalogueId === ppeCatalogueId);
                const linked = linkedPpeIds(
                  form.hazards.map((row) => row.hazardCategoryId).filter(Boolean),
                  hazards,
                );
                if (on && linked.has(ppeCatalogueId)) {
                  if (!(await confirmAction("This PPE is required by a hazard that is on for this permit. Turning it off matters. Turn it off?"))) return;
                }
                const nextOff = on
                  ? linked.has(ppeCatalogueId) ? [...new Set([...ppeManualOff, ppeCatalogueId])] : ppeManualOff
                  : ppeManualOff.filter((id) => id !== ppeCatalogueId);
                const nextOn = on
                  ? ppeManualOn.filter((id) => id !== ppeCatalogueId)
                  : linked.has(ppeCatalogueId) ? ppeManualOn : [...ppeManualOn, ppeCatalogueId];
                setPpeManualOff(nextOff);
                setPpeManualOn(nextOn);
                edit((current) => ({
                  ...current,
                  ppe: on
                    ? rows.filter((row) => row.ppeCatalogueId !== ppeCatalogueId)
                    : [...rows, { ppeCatalogueId, quantity: 1 }],
                }));
              })();
            }}
          />
        </div>
        ) : null}

        {siteSafetyStep === "lototo" ? (
        <div id="lototo" className="grid gap-4">
        <label className={safetyParameterClassName}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-primary"
            checked={form.lototoRequired}
            disabled={!siteEditable || !form.workLocationId}
            onChange={(e) =>
              edit({
                ...form,
                lototoRequired: e.target.checked,
                // A machine with a single plan: select it straight away.
                lototo: !e.target.checked
                  ? []
                  : form.lototo.length || machineryLototo.length !== 1
                    ? form.lototo
                    : [emptyPermitLototo(machineryLototo[0].id, form.executors.find((e) => e.isPrimary)?.workforceUserId || form.executors[0]?.workforceUserId)],
              })
            }
          />
          LOTOTO required
          {!form.workLocationId && siteEditable ? <span className="text-sm font-normal text-muted-foreground">(choose a work location first)</span> : null}
        </label>
        {fieldError("lototo") ? <p className="text-sm text-destructive">{fieldError("lototo")}</p> : null}
        {form.lototoRequired ? (
          <div className="grid gap-3">
            {machineryLototo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {form.assetIds.length > 0
                  ? "This location and the selected assets have no LOTOTO plan yet."
                  : "This location has no LOTOTO plan yet."}{" "}
                <a href="/lototo" target="_blank" rel="noreferrer" className="font-medium text-(--act-do) underline underline-offset-2">
                  Create one in a new tab
                </a>
                , then{" "}
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => {
                    const jobs: Promise<LototoProcedureListItem[]>[] = [];
                    if (form.workLocationId) jobs.push(listLototoProcedures({ workLocationId: form.workLocationId, published: true }).catch(() => []));
                    for (const assetId of form.assetIds) jobs.push(listLototoProcedures({ assetId, published: true }).catch(() => []));
                    void Promise.all(jobs).then((groups) => {
                      const byId = new Map<string, LototoProcedureListItem>();
                      for (const row of groups.flat()) byId.set(row.id, row);
                      setMachineryLototo([...byId.values()]);
                    }).catch(() => setMachineryLototo([]));
                  }}
                >
                  refresh the list
                </button>
                .
              </p>
            ) : (
              <div className="grid gap-4">
                {form.lototo.map((item, index) => (
                  <LototoAttachFields
                    key={`${item.procedureId}-${index}`}
                    item={item}
                    index={index}
                    procedures={machineryLototo}
                    detail={lototoDetails[item.procedureId]}
                    people={sodExecutorOptions}
                    verifierPeople={[
                      ...sodExecutorOptions,
                      ...safetyOfficerOptions.filter((person) => !sodExecutorOptions.some((row) => row.id === person.id)),
                    ]}
                    disabled={!siteEditable || Boolean(item.frozenAt)}
                    onChange={(next) =>
                      edit((current) => ({
                        ...current,
                        lototo: current.lototo.map((row, i) => (i === index ? next : row)),
                      }))
                    }
                    onRemove={() =>
                      edit((current) => ({
                        ...current,
                        lototo: current.lototo.filter((_, i) => i !== index),
                      }))
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-self-start"
                  disabled={!siteEditable || form.lototo.some((item) => Boolean(item.frozenAt))}
                  onClick={() =>
                    edit((current) => ({
                      ...current,
                      lototo: [
                        ...current.lototo,
                        emptyPermitLototo(
                          machineryLototo.length === 1 ? machineryLototo[0].id : "",
                          current.executors.find((e) => e.isPrimary)?.workforceUserId || current.executors[0]?.workforceUserId,
                        ),
                      ],
                    }))
                  }
                >
                  Add LOTOTO procedure
                </Button>
              </div>
            )}
          </div>
        ) : null}
        </div>
        ) : null}

        {siteSafetyStep === "gas" ? (
        <div className="grid gap-4">
        <label className={safetyParameterClassName}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-primary"
            checked={form.gasTestingRequired}
            disabled={!siteEditable || !form.workLocationId}
            onChange={(e) =>
              edit({
                ...form,
                gasTestingRequired: e.target.checked,
                gasReady: true,
                gasTesting: e.target.checked ? form.gasTesting : form.gasTesting.map((item) => item.gasTestingCatalogueId ? { ...item, removedReason: item.removedReason || "Not required for this permit" } : item),
              })
            }
          />
          Gas testing required
          {!form.workLocationId && siteEditable ? <span className="text-sm font-normal text-muted-foreground">(the receiver sets the work location first)</span> : null}
        </label>
        {gasLimitError ? <p className="text-sm text-(--status-warning)">{gasLimitError}</p> : null}
        {form.gasTestingRequired ? (
          <div className="grid gap-3">
            {form.gasTesting.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gas tests come from this location or the selected assets. Add one for this permit if the job needs it.</p>
            ) : form.gasTesting.map((item, index) => (
              <div key={`${item.gasTestingCatalogueId}-${index}`} className={cn("grid gap-2 rounded-xl border border-border p-4 text-sm", item.removedReason && "opacity-60")}>
                <p className="font-medium">{item.parameter || "Gas test"}{item.sourceName ? ` — ${item.sourceName}` : ""}</p>
                {item.removedReason ? (
                  <p>Removed for this permit: {item.removedReason}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="grid gap-1">Minimum
                      <input className={fieldClassName} type="number" value={item.minimum ?? ""} disabled={!siteEditable} onChange={(e) => {
                        const next = Number(e.target.value);
                        const baseline = item.gasTestingCatalogueId ? gasBaselines.get(item.gasTestingCatalogueId) : undefined;
                        if (baseline && e.target.value !== "" && Number.isFinite(next) && next < baseline.minimum) {
                          setGasLimitError("A limit cannot be loosened.");
                          return;
                        }
                        setGasLimitError(null);
                        edit((current) => ({ ...current, gasReady: true, gasTesting: current.gasTesting.map((row, i) => i === index ? { ...row, minimum: Number(e.target.value) } : row) }));
                      }} />
                    </label>
                    <label className="grid gap-1">Maximum
                      <input className={fieldClassName} type="number" value={item.maximum ?? ""} disabled={!siteEditable} onChange={(e) => {
                        const next = Number(e.target.value);
                        const baseline = item.gasTestingCatalogueId ? gasBaselines.get(item.gasTestingCatalogueId) : undefined;
                        if (baseline && e.target.value !== "" && Number.isFinite(next) && next > baseline.maximum) {
                          setGasLimitError("A limit cannot be loosened.");
                          return;
                        }
                        setGasLimitError(null);
                        edit((current) => ({ ...current, gasReady: true, gasTesting: current.gasTesting.map((row, i) => i === index ? { ...row, maximum: Number(e.target.value) } : row) }));
                      }} />
                    </label>
                    <p className="self-end text-muted-foreground">{item.unit}</p>
                  </div>
                )}
                {siteEditable && !item.gasTestingCatalogueId ? (
                  <button type="button" className="justify-self-start text-sm underline" onClick={() => edit((current) => ({ ...current, gasReady: true, gasTesting: current.gasTesting.filter((_, i) => i !== index) }))}>Remove</button>
                ) : null}
                {siteEditable && item.gasTestingCatalogueId ? (
                  item.removedReason ? (
                    <button type="button" className="justify-self-start text-sm underline" onClick={() => edit((current) => ({ ...current, gasReady: true, gasTesting: current.gasTesting.map((row, i) => i === index ? { ...row, removedReason: "" } : row) }))}>Restore</button>
                  ) : gasRemovalRequest?.index === index ? (
                    <div className="grid gap-2 rounded-lg border border-(--status-warning)/30 bg-(--status-warning-bg) p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                      <label className="grid gap-1 text-sm font-medium">
                        Reason required
                        <input
                          autoFocus
                          className={fieldClassName}
                          value={gasRemovalRequest.reason}
                          aria-label={`Reason for removing ${item.parameter} test`}
                          onChange={(event) => setGasRemovalRequest({ index, reason: event.target.value })}
                        />
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!gasRemovalRequest.reason.trim()}
                        onClick={() => {
                          const reason = gasRemovalRequest.reason.trim();
                          if (!reason) return;
                          edit((current) => ({ ...current, gasReady: true, gasTesting: current.gasTesting.map((row, i) => i === index ? { ...row, removedReason: reason } : row) }));
                          setGasRemovalRequest(null);
                        }}
                      >
                        Save reason
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setGasRemovalRequest(null)}>
                        Keep test
                      </Button>
                    </div>
                  ) : (
                    <button type="button" className="justify-self-start text-sm underline" onClick={() => setGasRemovalRequest({ index, reason: "" })}>Remove for this permit</button>
                  )
                ) : null}
              </div>
            ))}
            {siteEditable ? (
              <div className="grid gap-2 rounded-xl border border-dashed border-border p-4 sm:grid-cols-4">
                <input className={fieldClassName} placeholder="Parameter" value={extraGas.parameter} onChange={(e) => setExtraGas((current) => ({ ...current, parameter: e.target.value }))} />
                <input className={fieldClassName} placeholder="Unit" value={extraGas.unit} onChange={(e) => setExtraGas((current) => ({ ...current, unit: e.target.value }))} />
                <input className={fieldClassName} type="number" placeholder="Minimum" value={extraGas.minimum} onChange={(e) => setExtraGas((current) => ({ ...current, minimum: e.target.value }))} />
                <input className={fieldClassName} type="number" placeholder="Maximum" value={extraGas.maximum} onChange={(e) => setExtraGas((current) => ({ ...current, maximum: e.target.value }))} />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:col-span-4 justify-self-start"
                  onClick={() => {
                    const minimum = Number(extraGas.minimum);
                    const maximum = Number(extraGas.maximum);
                    if (!extraGas.parameter.trim() || !extraGas.unit.trim() || !(minimum < maximum)) return;
                    edit((current) => ({
                      ...current,
                      gasReady: true,
                      gasTestingRequired: true,
                      gasTesting: [...current.gasTesting, {
                        gasTestingCatalogueId: undefined,
                        parameter: extraGas.parameter.trim(),
                        unit: extraGas.unit.trim(),
                        minimum,
                        maximum,
                        sourceName: "Added for this permit",
                      }],
                    }));
                    setExtraGas({ parameter: "", unit: "", minimum: "", maximum: "" });
                  }}
                >
                  Add a test for this permit
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
        ) : null}

        {siteSafetyStep === "verification" ? (
        <label className={safetyParameterClassName}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-primary"
            disabled={!siteEditable}
            checked={form.executorSiteVisited}
            onChange={(e) => edit({ ...form, executorSiteVisited: e.target.checked })}
          />
          Site visited and verified
        </label>
        ) : null}

        {siteSafetyStep === "notes" ? (
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Additional job notes <span className="font-normal text-muted-foreground">(optional)</span></span>
          <textarea
            rows={3}
            maxLength={4000}
            disabled={!siteEditable}
            value={form.siteNotes}
            placeholder="Anything specific about this job"
            className={fieldClassName}
            onChange={(event) => edit({ ...form, siteNotes: event.target.value })}
          />
        </label>
        ) : null}
      </EditorSection>
      ) : null}

      {active === "crew" ? (
      <EditorSection id="crew" title="Crew" owner="Permit operator" editable={crewEditable} left={missing.crew.length} note={!crewEditable ? "Read-only until the operator holds the draft." : undefined}>
        <div className="grid gap-2">
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
                options={sodExecutorOptions.filter((person) => !crewRows.some((row) => row.workforceUserId === person.id))}
                placeholder="Add crew member"
                internalGroupLabel="Internal — Operators and receivers"
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
                  disabled={!soAssignable || masterDataLoading}
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
                  disabled={!soAssignable}
                  onClick={() => edit({ ...form, safetyOfficers: form.safetyOfficers.filter((_, i) => i !== index) })}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start"
              disabled={!soAssignable}
              onClick={() => edit({ ...form, safetyOfficers: [...form.safetyOfficers, { workforceUserId: "" }] })}
            >
              Add safety officer
            </Button>
          </div>
        </details>
      </EditorSection>
      ) : null}

      {active === "forms" ? (
      <EditorSection id="forms" title="Forms and evidence" owner="Permit receiver or operator" editable={formsEditable} left={missing.forms.length}>
        {!templatesLoaded && !masterDataLoading ? (
          <p role="alert" className="text-sm text-destructive">The forms for this permit could not be loaded. Reload the page to try again.</p>
        ) : forms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No permit forms or check sheets are linked to {permitTypes.find((type) => type.id === form.permitTypeId)?.name ?? "this permit type"}.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Details the permit already holds are filled in for you and not asked again. Questions marked * must be answered before the
              permit can be submitted.
            </p>
            {forms.map((template) => (
              <TemplateFormFill
                key={template.id}
                name={template.name}
                config={template.config!}
                answers={prefilled.formResponses[template.id] ?? {}}
                disabled={!formsEditable}
                signerName={signerName}
                anchorId={`form-${template.id}`}
                fromPermit={fromPermit}
                showMissing={errors.length > 0}
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
      ) : null}

      {active === "safety" ? (
      <EditorSection id="safety" title="Safety Approval" owner="Assigned safety officer" editable={safetyEditable} left={missing.safety.length}>
        <p className="text-sm text-muted-foreground">
          One assigned safety officer comments and types their name. That is enough to pass this step.
        </p>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Risks on this permit</h3>
          <p className="text-sm text-muted-foreground">Set by the operator in Site safety. Preview only here.</p>
          {permitSafetyRisks.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {permitSafetyRisks.map((line) => (
                <li key={`${line.hazard}:${line.risk}`}>
                  {line.hazard} — {line.risk}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No risks listed on this permit.</p>
          )}
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Safety controls on this permit</h3>
          <p className="text-sm text-muted-foreground">Set by the operator in Site safety. Preview only here.</p>
          {permitSafetyControls.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {permitSafetyControls.map((line) => (
                <li key={`${line.hazard}:${line.control}`}>
                  {line.hazard} — {line.control}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No safety controls listed on this permit.</p>
          )}
        </div>
        <label className={safetyParameterClassName}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-primary"
            disabled={!safetyEditable}
            checked={form.safetyOfficerSiteVisited}
            onChange={(e) => edit({ ...form, safetyOfficerSiteVisited: e.target.checked })}
          />
          Site visited and verified
        </label>
        <ul className="grid gap-1 text-sm">
          {form.safetyOfficers
            .filter((row) => row.workforceUserId)
            .map((row) => (
              <li key={row.workforceUserId}>{personName(row.workforceUserId)}</li>
            ))}
        </ul>
        <FormField label="Comments" htmlFor="safetyApprovalComment" error={fieldError("safetyApprovalComment")}>
          <textarea
            id="safetyApprovalComment"
            className={`${fieldClassName} min-h-24 py-2`}
            value={form.safetyApprovalComment}
            disabled={!safetyEditable}
            onChange={(e) => edit({ ...form, safetyApprovalComment: e.target.value })}
          />
        </FormField>
        <FormField label="Typed name" htmlFor="safetyApprovalSignedName" error={fieldError("safetyApprovalSignedName")}>
          <div className="flex flex-wrap gap-2">
            <input
              id="safetyApprovalSignedName"
              className={`${fieldClassName} min-w-48 flex-1`}
              value={form.safetyApprovalSignedName}
              disabled={!safetyEditable}
              onChange={(e) => edit({ ...form, safetyApprovalSignedName: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!safetyEditable}
              onClick={() => edit({ ...form, safetyApprovalSignedName: form.safetyApprovalSignedName.trim() || signerName })}
            >
              <PenLine aria-hidden />
              Me
            </Button>
          </div>
        </FormField>
      </EditorSection>
      ) : null}

      {active === "review" ? (
      <EditorSection id="review" title="Review" owner="Permit receiver" editable={draftHolder === "ready_for_review" && canSubmit} left={0} note={draftHolder !== "ready_for_review" ? "Submit after the last handoff (Ready for review)." : undefined}>
        <div className="flex flex-wrap gap-2">
          {visibleSections.filter((section) => section.id !== "review").map((section) => (
            <Button key={section.id} type="button" variant="ghost" className="min-h-11" onClick={() => goTo(section.id)}>
              <Pencil aria-hidden />
              Change {section.label}
            </Button>
          ))}
        </div>
        <section aria-labelledby="submission-readiness-title" className="overflow-hidden rounded-xl border border-border">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <div>
              <h3 id="submission-readiness-title" className="text-sm font-semibold">Submission readiness</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Check each section before sending this permit for approval.</p>
            </div>
            <span className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              reviewSections.some((section) => missing[section.id].length) ? "bg-(--status-warning-bg) text-(--status-warning)" : "bg-(--status-success-bg) text-(--status-success)",
            )}>
              {reviewSections.filter((section) => missing[section.id].length).length
                ? `${reviewSections.filter((section) => missing[section.id].length).length} sections need attention`
                : "Ready for final review"}
            </span>
          </header>
          <ul className="divide-y divide-border">
            {reviewSections.map((section) => {
              const sectionGaps = missing[section.id];
              const ready = sectionGaps.length === 0;
              return (
                <li key={section.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  {ready ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-(--status-success)" aria-label="Ready" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-(--status-warning)" aria-label="Needs attention" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className={cn("mt-0.5 text-xs", ready ? "text-muted-foreground" : "text-(--status-warning)")}>
                      {ready ? "Required information is present" : sectionGaps.join("; ")}
                    </p>
                  </div>
                  {!ready ? (
                    <Button type="button" variant="ghost" className="min-h-9 shrink-0 px-2 text-xs" onClick={() => goTo(section.id)}>
                      Fix section
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
        <PermitSummary
          form={form}
          status={status}
          attachments={attachments}
          showHeader={false}
          showSectionNavigation
          placeText={[
            sites.find((row) => row.id === form.siteId)?.name,
            workLocations.find((row) => row.id === form.workLocationId)?.pathText,
            form.exactSpot,
            siteAssets.filter((row) => form.assetIds.includes(row.id)).map((row) => `${row.tag} ${row.name}`).join(", "),
          ].filter(Boolean).join(" — ")}
          identity={initialDetail ? identityFromPermit(initialDetail.permit) : { version: 1 }}
        />
        <label className={safetyParameterClassName}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-primary"
            disabled={isExecutor}
            checked={form.receiverSiteVisited}
            onChange={(e) => edit({ ...form, receiverSiteVisited: e.target.checked })}
          />
          Site visited and verified
        </label>
        <p className="text-sm text-muted-foreground">
          {isExecutor
            ? `${saveLabel} when you are done. The job issuer reviews the permit and submits it for approval.`
            : "Submitting saves your changes and sends the permit for approval. Saving the draft does not authorise any work."}
        </p>
      </EditorSection>
      ) : null}

        </div>
      </div>

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
          <Button type="button" size="lg" className="min-h-11 px-4" variant="secondary" onClick={() => void handleSaveDraft()} disabled={isSaving || isSubmitting || conflicts.length > 0}>
            {isSaving ? "Saving…" : saveLabel}
          </Button>
        ) : null}
        {showReturn && showReturnForm && returnHold ? (
          <div className="flex w-full flex-col gap-2 sm:max-w-md">
            <label htmlFor="why-return" className="text-sm font-medium">
              Why return
            </label>
            <textarea
              id="why-return"
              className={`${fieldClassName} min-h-20 py-2`}
              value={returnReasonDraft}
              onChange={(e) => setReturnReasonDraft(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="lg" variant="outline" className="min-h-11 px-4" disabled={isSaving} onClick={() => setShowReturnForm(false)}>
                Cancel
              </Button>
              <Button type="button" size="lg" className="min-h-11 px-4" disabled={isSaving || isSubmitting || !returnReasonDraft.trim()} onClick={() => void handleReturnDraft()}>
                {returnButtonLabel(returnHold)}
              </Button>
            </div>
          </div>
        ) : null}
        {showReturn && !showReturnForm ? (
          <Button type="button" size="lg" variant="outline" className="min-h-11 px-4" disabled={isSaving || isSubmitting} onClick={() => setShowReturnForm(true)}>
            {returnHold ? returnButtonLabel(returnHold) : "Return"}
          </Button>
        ) : null}
        {showHandoff ? (
          <Button type="button" size="lg" className="min-h-11 px-4" disabled={isSaving || isSubmitting || conflict} onClick={() => void handleHandoff()}>
            {nextHold ? handoffButtonLabel(nextHold, selfOperator) : "Hand over"}
          </Button>
        ) : null}
        {activeIndex > 0 || (active === "site" && siteSafetyStep !== SITE_SAFETY_STEPS[0].id) ? (
          <Button type="button" size="lg" variant="outline" className="min-h-11 px-4" onClick={handleBack}>
            <ChevronLeft aria-hidden />
            Back
          </Button>
        ) : null}
        {active !== "review" ? (
          <Button type="button" size="lg" className="min-h-11 px-4" onClick={handleNext}>
            {active === "site" && siteSafetyStep !== SITE_SAFETY_STEPS[SITE_SAFETY_STEPS.length - 1].id ? "Next safety section" : active === "site" ? "Continue to Crew" : "Next"}
            <ChevronRight aria-hidden />
          </Button>
        ) : canSubmit && draftHolder === "ready_for_review" ? (
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
      {note ? <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{note}</p> : null}
      {children}
    </section>
  );
}

/** Searchable multi-select list for catalogue items. */
function ChipPicker({
  label,
  options,
  selected,
  disabled,
  empty,
  selectionStyle = "checkbox",
  quantityFor,
  onQuantityChange,
  onToggle,
}: {
  label: string;
  options: { id: string; name: string; hint?: string }[];
  selected: string[];
  disabled: boolean;
  empty?: string;
  selectionStyle?: "checkbox" | "row";
  quantityFor?: (id: string) => number | undefined;
  onQuantityChange?: (id: string, quantity: number) => void;
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(normalizedQuery),
  );
  const normalizedLabel = label.toLowerCase();
  const searchId = `${normalizedLabel.replace(/\s+/g, "-")}-search`;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-baseline gap-2">
          <h3 className="font-sans text-base font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {selected.length} selected
          </p>
        </div>
        {options.length ? (
          <div className="relative w-full sm:mt-0.5 sm:w-72">
            <label htmlFor={searchId} className="sr-only">Search {normalizedLabel}</label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${normalizedLabel}`}
              disabled={disabled}
              className={cn(fieldClassName, "h-10 pl-9")}
            />
          </div>
        ) : null}
      </div>
      {options.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          {empty ?? "Nothing to choose from yet. An administrator adds these under Organisation."}
        </p>
      ) : filteredOptions.length ? (
        <div role="group" aria-label={label} className="grid gap-x-6 sm:grid-cols-2">
          {filteredOptions.map((option) => {
            const on = selected.includes(option.id);
            const checkboxId = `${searchId}-${option.id}`;
            const rowStyle = selectionStyle === "row";
            const quantity = quantityFor?.(option.id);
            return (
              <div
                key={option.id}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 border-b border-border px-2 py-2 text-sm transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-60",
                  rowStyle && "rounded-md border border-transparent px-3",
                  rowStyle && on && "border-primary/30 bg-primary/5 font-medium",
                  !rowStyle && on && "bg-primary/5 font-medium",
                )}
              >
                <label htmlFor={checkboxId} className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    onChange={() => onToggle(option.id)}
                    className={cn(
                      "size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      rowStyle && "peer sr-only",
                    )}
                  />
                  {rowStyle ? (
                    <span
                      aria-hidden
                      className="grid size-5 shrink-0 place-items-center rounded-full border border-input bg-background text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
                    >
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    {option.name}
                    {option.hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span> : null}
                  </span>
                </label>
                {on && quantityFor && onQuantityChange ? (
                  <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>Qty</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={quantity ?? 1}
                      disabled={disabled}
                      aria-label={`${option.name} quantity`}
                      onChange={(event) => onQuantityChange(option.id, Math.max(1, Number(event.target.value) || 1))}
                      className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-3 text-sm text-muted-foreground">
          No {normalizedLabel} match “{query.trim()}”.
        </p>
      )}
    </div>
  );
}

function ConfiguredList({
  title,
  items,
  empty,
  omitted = [],
  disabled,
  onOmit,
}: {
  title: string;
  items: string[];
  empty: string;
  omitted?: string[];
  disabled?: boolean;
  onOmit?: (omitted: string[]) => void;
}) {
  const skip = new Set(omitted);
  const visible = items.filter((item) => !skip.has(item));
  const removed = omitted.filter((item) => items.includes(item));
  return (
    <div className="grid gap-1">
      <p className="text-sm font-medium">{title}</p>
      {visible.length ? (
        <ul className="space-y-1 text-sm">
          {visible.map((item) => (
            <li key={item} className="flex items-start justify-between gap-2">
              <span>{item}</span>
              {onOmit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Remove ${item} from this permit`}
                  onClick={() => onOmit([...omitted, item])}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
      {removed.length && onOmit ? (
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Removed for this permit only. Catalogue is unchanged.</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {removed.map((item) => (
              <li key={`omitted-${item}`} className="flex items-start justify-between gap-2">
                <span className="line-through">{item}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Restore ${item} on this permit`}
                  onClick={() => onOmit(omitted.filter((line) => line !== item))}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ExtraStringList({
  label,
  values,
  disabled,
  onChange,
}: {
  label: string;
  values: string[];
  disabled: boolean;
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      {values.map((value, index) => (
        <div key={`${label}-${index}`} className="flex gap-2">
          <input
            aria-label={`${label} ${index + 1}`}
            className={fieldClassName}
            value={value}
            disabled={disabled}
            onChange={(event) => {
              const next = [...values];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            aria-label={`Remove ${label} ${index + 1}`}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            <X aria-hidden />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...values, ""])}>
        Add
      </Button>
    </div>
  );
}
