import { requiredForSubmit, type PermitTemplate } from "@/lib/organisation/templates";
import type {
  DraftFields,
  FormAnswer,
  PermitDetail,
  PermitFormState,
  PermitHazardInput,
  PermitLototoExtraInput,
  PermitLototoInput,
} from "./types";

/** "shared": either the issuer or the assigned executor fills it in. */
export type WizardParticipant = "permit-receiver" | "permit-operator" | "shared" | "safety-officer";

export const PERMIT_WIZARD_STEPS = [
  { label: "Basic information", owner: "permit-receiver" satisfies WizardParticipant },
  { label: "Location & schedule", owner: "permit-receiver" satisfies WizardParticipant },
  { label: "On-site details", owner: "permit-operator" satisfies WizardParticipant },
  { label: "Crew assignment", owner: "permit-operator" satisfies WizardParticipant },
  { label: "Forms & check sheets", owner: "shared" satisfies WizardParticipant },
  { label: "Safety Approval", owner: "safety-officer" satisfies WizardParticipant },
  { label: "Review & submit", owner: "permit-receiver" satisfies WizardParticipant },
] as const;

/**
 * The editor's steps (one shown at a time), over the stored step indices above (the server, the journey page
 * and the native app keep using those). `steps[0]` is what currentStep records for the section.
 */
export const PERMIT_EDITOR_SECTIONS = [
  { id: "work", label: "Work", steps: [0] },
  { id: "place", label: "Place and schedule", steps: [1] },
  { id: "site", label: "Site safety", steps: [2] },
  { id: "crew", label: "Crew", steps: [3] },
  { id: "forms", label: "Forms and evidence", steps: [4] },
  { id: "safety", label: "Safety Approval", steps: [5] },
  { id: "review", label: "Review", steps: [6] },
] as const;
export type PermitEditorSectionId = (typeof PERMIT_EDITOR_SECTIONS)[number]["id"];

/** A short title suggested from the work scope: its first line or sentence, at most 120 characters. */
export function titleFromScope(scope: string): string {
  const first = scope.trim().split(/\n|(?<=[.!?])\s/)[0]?.trim().replace(/[.!?]+$/, "") ?? "";
  if (first.length <= 120) return first;
  const cut = first.slice(0, 120);
  return cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : 120).trimEnd() + "…";
}

export function emptyPermitLototo(procedureId: string, operatorId?: string): PermitLototoInput {
  return {
    procedureId,
    extraPoints: [],
    stepNa: [],
    crew: [],
    verifiers: operatorId ? [{ workforceUserId: operatorId }] : [],
  };
}

export function emptyLototoExtraPoint(): PermitLototoExtraInput {
  return {
    pointCode: "",
    energyType: "electrical",
    energyOtherText: "",
    magnitude: "",
    locationText: "",
    action: "",
    device: "",
    verificationMethod: "",
  };
}

export function getWizardStepOwner(step: number): WizardParticipant {
  return PERMIT_WIZARD_STEPS[step]?.owner ?? "permit-receiver";
}

export function canRoleEditWizardStep(roles: string[], step: number): boolean {
  const owner = getWizardStepOwner(step);
  const privileged =
    roles.includes("tenant-owner") || roles.includes("tenant-admin") || roles.includes("platform-admin");
  if (owner === "shared") {
    return roles.includes("permit-receiver") || roles.includes("permit-operator") || privileged;
  }
  if (owner === "permit-receiver") {
    return roles.includes("permit-receiver") || privileged;
  }
  if (owner === "safety-officer") {
    return roles.includes("safety-officer") || privileged;
  }
  return roles.includes("permit-operator") || privileged;
}

export function needsSafetyApproval(form: PermitFormState): boolean {
  return form.safetyOfficers.some((row) => (row.workforceUserId ?? "").trim());
}

export function editorSectionsFor(form: PermitFormState) {
  return PERMIT_EDITOR_SECTIONS.filter((section) => section.id !== "safety" || needsSafetyApproval(form));
}

export function canRoleSubmitPermit(roles: string[]): boolean {
  return (
    roles.includes("permit-receiver") ||
    roles.includes("tenant-owner") ||
    roles.includes("tenant-admin") ||
    roles.includes("platform-admin")
  );
}

export function emptyPermitHazard(hazardCategoryId = ""): PermitHazardInput {
  return {
    hazardCategoryId,
    extraConsequences: [],
    extraRisks: [],
    extraControls: [],
    omittedConsequences: [],
    omittedRisks: [],
    omittedControls: [],
  };
}

export function catalogueLinesForPermit(
  catalogue: string[] | null | undefined,
  omitted: string[] | null | undefined,
): string[] {
  const skip = new Set((omitted ?? []).map((line) => line.trim()).filter(Boolean));
  return (catalogue ?? []).map((line) => line.trim()).filter((line) => line && !skip.has(line));
}

export function permitControlLines(
  catalogue: string[] | null | undefined,
  extra: string[] | null | undefined,
  omitted: string[] | null | undefined,
): string[] {
  return [
    ...catalogueLinesForPermit(catalogue, omitted),
    ...(extra ?? []).map((line) => line.trim()).filter(Boolean),
  ];
}

export function createEmptyPermitForm(): PermitFormState {
  return {
    permitTypeId: "",
    title: "",
    workScope: "",
    siteNotes: "",
    emergencyPhone: "",
    plantId: "",
    departmentId: "",
    locationId: "",
    workstationId: "",
    machineryId: "",
    siteId: "",
    workLocationId: "",
    exactSpot: "",
    assetIds: [],
    gasReady: false,
    plannedStartAt: "",
    plannedEndAt: "",
    hazards: [emptyPermitHazard()],
    ppe: [{ ppeCatalogueId: "", quantity: 1 }],
    lototoRequired: false,
    lototo: [],
    gasTestingRequired: false,
    gasTesting: [],
    executors: [{ workforceUserId: "", isPrimary: true }],
    viewers: [],
    safetyOfficers: [],
    safetyApprovalComment: "",
    safetyApprovalSignedName: "",
    receiverSiteVisited: false,
    executorSiteVisited: false,
    safetyOfficerSiteVisited: false,
    formResponses: {},
    currentStep: 0,
  };
}

/**
 * Stored instants are UTC; form fields hold local "YYYY-MM-DDTHH:mm" (converted back with
 * toISOString on save). Slicing the UTC string would shift the time by the UTC offset on every save.
 */
function toDateInputValue(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function permitDetailToForm(detail: PermitDetail): PermitFormState {
  const { permit, draft, hazards, ppe, lototo, gasTesting, executors, viewers, safetyOfficers } = detail;

  return {
    permitTypeId: permit.permitTypeId,
    title: permit.title,
    workScope: permit.workScope ?? "",
    siteNotes: permit.siteNotes ?? "",
    emergencyPhone: permit.emergencyPhone ?? "",
    plantId: permit.plantId ?? "",
    departmentId: permit.departmentId ?? "",
    locationId: permit.locationId ?? "",
    workstationId: permit.workstationId ?? "",
    machineryId: permit.machineryId ?? "",
    siteId: permit.siteId ?? "",
    workLocationId: permit.workLocationId ?? "",
    exactSpot: permit.exactSpot ?? "",
    assetIds: (detail.assets ?? []).map((row) => row.assetId),
    gasReady: true,
    plannedStartAt: toDateInputValue(permit.plannedStartAt),
    plannedEndAt: toDateInputValue(permit.plannedEndAt),
    hazards:
      hazards.length > 0
        ? hazards.map((h) => ({
            hazardCategoryId: h.hazardCategoryId,
            extraConsequences: h.extraConsequences ?? [],
            extraRisks: h.extraRisks ?? [],
            extraControls: h.extraControls ?? [],
            omittedConsequences: h.omittedConsequences ?? [],
            omittedRisks: h.omittedRisks ?? [],
            omittedControls: h.omittedControls ?? [],
          }))
        : [emptyPermitHazard()],
    ppe:
      ppe.length > 0
        ? ppe.map((item) => ({
            ppeCatalogueId: item.ppeCatalogueId,
            quantity: item.quantity ?? 1,
          }))
        : [{ ppeCatalogueId: "", quantity: 1 }],
    lototoRequired: permit.lototoRequired === true,
    lototo:
      lototo.length > 0
        ? lototo.map((item) => ({
            ...emptyPermitLototo(item.procedureId),
            frozenAt: item.frozenAt ?? null,
            extraPoints: item.extraPoints ?? [],
            stepNa: item.stepNa ?? [],
            crew: item.crew ?? [],
            verifiers: item.verifiers ?? [],
            verification: item.verification ?? [],
          }))
        : [],
    gasTestingRequired: permit.gasTestingRequired === true,
    gasTesting:
      gasTesting.length > 0
        ? gasTesting
            .filter((item) => item.gasTestingCatalogueId || (item.parameter?.trim() && item.unit?.trim()))
            .map((item) => ({
              gasTestingCatalogueId: item.gasTestingCatalogueId ?? undefined,
              parameter: item.parameter,
              unit: item.unit,
              minimum: item.minimum,
              maximum: item.maximum,
              removedReason: item.removedReason ?? "",
              sourceName: item.gasTestingCatalogueId ? undefined : "Added for this permit",
            }))
        : [],
    executors:
      executors.length > 0
        ? executors.map((e) => ({
            workforceUserId: e.workforceUserId ?? "",
            isPrimary: e.isPrimary ?? false,
          }))
        : [{ workforceUserId: "", isPrimary: true }],
    viewers: (viewers ?? []).map((row) => ({ workforceUserId: row.workforceUserId })),
    safetyOfficers: (safetyOfficers ?? []).map((row) => ({ workforceUserId: row.workforceUserId })),
    safetyApprovalComment: permit.safetyApprovalComment ?? "",
    safetyApprovalSignedName: permit.safetyApprovalSignedName ?? "",
    receiverSiteVisited: permit.receiverSiteVisited === true,
    executorSiteVisited: permit.executorSiteVisited === true,
    safetyOfficerSiteVisited: permit.safetyOfficerSiteVisited === true,
    formResponses: Object.fromEntries((permit.formResponses ?? []).map((response) => [response.templateId, response.answers])),
    currentStep: draft?.currentStep ?? 0,
  };
}

export function shouldSaveExecutorPayload(roles: string[]): boolean {
  return roles.includes("permit-operator") && !canRoleSubmitPermit(roles);
}

export function shouldSaveSafetyApprovalOnly(roles: string[]): boolean {
  return (
    roles.includes("safety-officer") &&
    !canRoleSubmitPermit(roles) &&
    !shouldSaveExecutorPayload(roles)
  );
}

function optionalUuid(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

export function formToSavePayload(
  form: PermitFormState,
  options?: { executorOnly?: boolean; includeSafetyApproval?: boolean; safetyApprovalOnly?: boolean },
): DraftFields {
  const payload = {
    permitTypeId: form.permitTypeId,
    title: form.title,
    workScope: form.workScope || undefined,
    siteNotes: form.siteNotes.trim(),
    emergencyPhone: form.emergencyPhone.trim(),
    plantId: optionalUuid(form.plantId),
    departmentId: optionalUuid(form.departmentId),
    locationId: optionalUuid(form.locationId),
    workstationId: optionalUuid(form.workstationId),
    machineryId: optionalUuid(form.machineryId),
    siteId: optionalUuid(form.siteId),
    workLocationId: optionalUuid(form.workLocationId),
    exactSpot: form.exactSpot.trim() || undefined,
    assetIds: form.assetIds,
    plannedStartAt: form.plannedStartAt ? new Date(form.plannedStartAt).toISOString() : undefined,
    plannedEndAt: form.plannedEndAt ? new Date(form.plannedEndAt).toISOString() : undefined,
    currentStep: form.currentStep,
    hazards: form.hazards
      .filter((h) => h.hazardCategoryId.trim())
      .map((h) => ({
        hazardCategoryId: h.hazardCategoryId,
        extraConsequences: (h.extraConsequences ?? []).map((value) => value.trim()).filter(Boolean),
        extraRisks: (h.extraRisks ?? []).map((value) => value.trim()).filter(Boolean),
        extraControls: (h.extraControls ?? []).map((value) => value.trim()).filter(Boolean),
        omittedConsequences: (h.omittedConsequences ?? []).map((value) => value.trim()).filter(Boolean),
        omittedRisks: (h.omittedRisks ?? []).map((value) => value.trim()).filter(Boolean),
        omittedControls: (h.omittedControls ?? []).map((value) => value.trim()).filter(Boolean),
      })),
    ppe: form.ppe.filter((p) => p.ppeCatalogueId.trim()),
    lototoRequired: form.lototoRequired,
    lototo: form.lototo
      .filter((item) => item.procedureId.trim())
      .map((item) => ({
        procedureId: item.procedureId,
        extraPoints: (item.extraPoints ?? [])
          .filter((point) => point.pointCode.trim())
          .map((point) => ({
            pointCode: point.pointCode,
            energyType: point.energyType,
            magnitude: point.magnitude,
            locationText: point.locationText,
            action: point.action,
            device: point.device,
            verificationMethod: point.verificationMethod,
          })),
        stepNa: (item.stepNa ?? [])
          .filter((row) => row.reason.trim())
          .map((row) => ({
            ...(row.basePointId ? { basePointId: row.basePointId } : {}),
            ...(row.extraPointCode ? { extraPointCode: row.extraPointCode } : {}),
            reason: row.reason,
          })),
        crew: (item.crew ?? [])
          .filter((row) => row.workforceUserId.trim())
          .map((row) => ({ workforceUserId: row.workforceUserId })),
        verifiers: (item.verifiers ?? [])
          .filter((row) => row.workforceUserId.trim())
          .map((row) => ({ workforceUserId: row.workforceUserId })),
      })),
    gasTestingRequired: form.gasTestingRequired,
    ...(form.gasReady
      ? {
          gasTesting: form.gasTesting
            .filter((item) => item.gasTestingCatalogueId?.trim() || (item.parameter?.trim() && item.unit?.trim() && item.minimum != null && item.maximum != null))
            .map((item) => item.gasTestingCatalogueId?.trim()
              ? {
                  gasTestingCatalogueId: item.gasTestingCatalogueId,
                  ...(item.minimum != null ? { minimum: item.minimum } : {}),
                  ...(item.maximum != null ? { maximum: item.maximum } : {}),
                  ...(item.removedReason?.trim() ? { removedReason: item.removedReason.trim() } : {}),
                }
              : {
                  parameter: item.parameter!.trim(),
                  unit: item.unit!.trim(),
                  minimum: item.minimum!,
                  maximum: item.maximum!,
                }),
        }
      : {}),
    executors: form.executors.filter((e) => (e.workforceUserId ?? "").trim()),
    viewers: form.viewers.filter((e) => (e.workforceUserId ?? "").trim()),
    safetyOfficers: form.safetyOfficers.filter((e) => (e.workforceUserId ?? "").trim()),
    formResponses: Object.entries(form.formResponses).map(([templateId, answers]) => ({ templateId, answers })),
    receiverSiteVisited: form.receiverSiteVisited,
    executorSiteVisited: form.executorSiteVisited,
  };

  const safetyApproval = options?.includeSafetyApproval || options?.safetyApprovalOnly
    ? {
        safetyApprovalComment: form.safetyApprovalComment.trim(),
        safetyApprovalSignedName: form.safetyApprovalSignedName.trim(),
        safetyOfficerSiteVisited: form.safetyOfficerSiteVisited,
      }
    : {};

  if (options?.safetyApprovalOnly) {
    return safetyApproval;
  }

  if (!options?.executorOnly) {
    return { ...payload, ...safetyApproval };
  }

  return {
    workstationId: payload.workstationId,
    machineryId: payload.machineryId,
    assetIds: payload.assetIds,
    ...(payload.gasTesting ? { gasTesting: payload.gasTesting } : {}),
    currentStep: payload.currentStep,
    hazards: payload.hazards,
    ppe: payload.ppe,
    lototoRequired: payload.lototoRequired,
    lototo: payload.lototo,
    gasTestingRequired: payload.gasTestingRequired,
    executors: payload.executors,
    safetyOfficers: payload.safetyOfficers,
    formResponses: payload.formResponses,
    executorSiteVisited: payload.executorSiteVisited,
    ...safetyApproval,
  };
}

/** Published templates linked to the permit's type, permit forms first. */
export function applicableTemplates(templates: PermitTemplate[], permitTypeId: string): PermitTemplate[] {
  return templates
    .filter((t) => t.status === "published" && t.config && (t.appliesToAllTypes || t.permitTypeIds.includes(permitTypeId)))
    .sort((a, b) => Number(b.config?.kind === "permit") - Number(a.config?.kind === "permit") || a.name.localeCompare(b.name));
}

export function isAnswered(value: FormAnswer | undefined): boolean {
  if (value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Boolean(value.name?.trim());
  return String(value).trim() !== "";
}

/** Required fields not yet answered on a template, as labels. */
export function missingRequired(template: PermitTemplate, form: PermitFormState): string[] {
  const answers = form.formResponses[template.id] ?? {};
  return (template.config?.sections ?? [])
    .flatMap((section) => section.fields)
    .filter((field) => requiredForSubmit(field) && !isAnswered(answers[field.id]))
    .map((field) => field.label);
}

/**
 * `templates`: the templates that apply to this permit (see applicableTemplates).
 * `machinery`: active machines; machinery is required when the chosen workstation has any.
 */
/** The control each editor error belongs to, so its link and its message go to the field itself. */
export const ERROR_FIELDS: Record<string, string> = {
  "Title is required": "title",
  "Department is required": "departmentId",
  "Site is required": "siteId",
  "Work location is required": "workLocationId",
  "Location is required": "locationId",
  "Planned start date and time are required": "plannedStartAt",
  "Planned end date and time are required": "plannedEndAt",
  "Planned end must be after planned start": "plannedEndAt",
  "Assign a primary executor before handing off on-site details": "primary-executor",
  "Workstation is required": "workstationId",
  "Machinery is required": "machineryId",
  "A work location is required when attaching LOTOTO procedures": "workLocationId",
  "LOTOTO procedures must belong to the selected location or a selected asset": "lototo",
  "Machinery is required when LOTOTO is required": "machineryId",
  "Safety Approval comments are required": "safetyApprovalComment",
  "A typed name is required for Safety Approval": "safetyApprovalSignedName",
};

export function validateStep(
  form: PermitFormState,
  step: number,
  templates: PermitTemplate[] = [],
  machinery: { workstationId?: string | null }[] = [],
): string[] {
  const errors: string[] = [];

  if (step === 0) {
    if (!form.permitTypeId.trim()) errors.push("Permit type is required");
    if (!form.title.trim()) errors.push("Title is required");
  }

  if (step === 1) {
    if (!form.siteId.trim()) errors.push("Site is required");
    if (!form.workLocationId.trim()) errors.push("Work location is required");
    if (!form.plannedStartAt) errors.push("Planned start date and time are required");
    if (!form.plannedEndAt) errors.push("Planned end date and time are required");
    if (form.plannedStartAt && form.plannedEndAt && form.plannedEndAt <= form.plannedStartAt) {
      errors.push("Planned end must be after planned start");
    }
    if (!form.executors.some((e) => (e.workforceUserId ?? "").trim())) {
      errors.push("Assign a primary executor before handing off on-site details");
    }
  }

  if (step === 2) {
    void machinery;
    if (!form.hazards.some((h) => h.hazardCategoryId.trim())) {
      errors.push("At least one hazard is required");
    }
    if (form.lototoRequired) {
      if (!form.lototo.some((item) => item.procedureId.trim())) {
        errors.push("Select at least one LOTOTO procedure");
      }
    }
    if (form.gasTestingRequired) {
      if (!form.gasTesting.some((item) => !item.removedReason?.trim() && (item.gasTestingCatalogueId?.trim() || item.parameter?.trim()))) {
        errors.push("Select at least one gas testing item");
      }
    }
  }

  if (step === 3) {
    if (!form.executors.some((e) => (e.workforceUserId ?? "").trim())) {
      errors.push("At least one executor is required");
    }
  }

  if (step === 4) {
    for (const template of templates) {
      const missing = missingRequired(template, form);
      if (missing.length) {
        errors.push(`${template.name}: answer ${missing.length === 1 ? `“${missing[0]}”` : `${missing.length} required questions`}`);
      }
    }
  }

  if (step === 5 && needsSafetyApproval(form)) {
    if (!form.safetyApprovalComment.trim()) errors.push("Safety Approval comments are required");
    if (!form.safetyApprovalSignedName.trim()) errors.push("A typed name is required for Safety Approval");
  }

  return errors;
}
