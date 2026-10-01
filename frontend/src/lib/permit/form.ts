import { requiredForSubmit, type PermitTemplate } from "@/lib/organisation/templates";
import type { FormAnswer, PermitDetail, PermitFormState, DraftFields } from "./types";

/** "shared": either the issuer or the assigned executor fills it in. */
export type WizardParticipant = "job-issuer" | "operator" | "shared";

export const PERMIT_WIZARD_STEPS = [
  { label: "Basic information", owner: "job-issuer" satisfies WizardParticipant },
  { label: "Location & schedule", owner: "job-issuer" satisfies WizardParticipant },
  { label: "On-site details", owner: "operator" satisfies WizardParticipant },
  { label: "Crew assignment", owner: "operator" satisfies WizardParticipant },
  { label: "Forms & check sheets", owner: "shared" satisfies WizardParticipant },
  { label: "Review & submit", owner: "job-issuer" satisfies WizardParticipant },
] as const;

/**
 * The one-page editor's sections, over the stored step indices above (the server, the journey page
 * and the native app keep using those). `steps[0]` is what currentStep records for the section.
 */
export const PERMIT_EDITOR_SECTIONS = [
  { id: "work", label: "Work", steps: [0] },
  { id: "place", label: "Place and schedule", steps: [1] },
  { id: "site", label: "Site and crew", steps: [2, 3] },
  { id: "forms", label: "Forms and evidence", steps: [4] },
  { id: "review", label: "Review", steps: [5] },
] as const;
export type PermitEditorSectionId = (typeof PERMIT_EDITOR_SECTIONS)[number]["id"];

/** A short title suggested from the work scope: its first line or sentence, at most 120 characters. */
export function titleFromScope(scope: string): string {
  const first = scope.trim().split(/\n|(?<=[.!?])\s/)[0]?.trim().replace(/[.!?]+$/, "") ?? "";
  if (first.length <= 120) return first;
  const cut = first.slice(0, 120);
  return cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : 120).trimEnd() + "…";
}

export function getWizardStepOwner(step: number): WizardParticipant {
  return PERMIT_WIZARD_STEPS[step]?.owner ?? "job-issuer";
}

export function canRoleEditWizardStep(roles: string[], step: number): boolean {
  const owner = getWizardStepOwner(step);
  const privileged =
    roles.includes("tenant-owner") || roles.includes("tenant-admin") || roles.includes("platform-admin");
  if (owner === "shared") {
    return roles.includes("job-issuer") || roles.includes("operator") || privileged;
  }
  if (owner === "job-issuer") {
    return roles.includes("job-issuer") || privileged;
  }
  return roles.includes("operator") || privileged;
}

export function canRoleSubmitPermit(roles: string[]): boolean {
  return (
    roles.includes("job-issuer") ||
    roles.includes("tenant-owner") ||
    roles.includes("tenant-admin") ||
    roles.includes("platform-admin")
  );
}

export function createEmptyPermitForm(): PermitFormState {
  return {
    permitTypeId: "",
    title: "",
    workScope: "",
    plantId: "",
    departmentId: "",
    locationId: "",
    workstationId: "",
    machineryId: "",
    plannedStartAt: "",
    plannedEndAt: "",
    hazards: [{ hazardCategoryId: "", description: "" }],
    ppe: [{ ppeCatalogueId: "", quantity: 1 }],
    lototoRequired: false,
    lototo: [],
    gasTestingRequired: false,
    gasTesting: [],
    executors: [{ workforceUserId: "", isPrimary: true }],
    viewers: [],
    safetyOfficers: [],
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
    plantId: permit.plantId ?? "",
    departmentId: permit.departmentId ?? "",
    locationId: permit.locationId ?? "",
    workstationId: permit.workstationId ?? "",
    machineryId: permit.machineryId ?? "",
    plannedStartAt: toDateInputValue(permit.plannedStartAt),
    plannedEndAt: toDateInputValue(permit.plannedEndAt),
    hazards:
      hazards.length > 0
        ? hazards.map((h) => ({
            hazardCategoryId: h.hazardCategoryId,
            description: h.description ?? "",
          }))
        : [{ hazardCategoryId: "", description: "" }],
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
        ? lototo.map((item) => ({ lototoPlanId: item.lototoPlanId }))
        : [],
    gasTestingRequired: permit.gasTestingRequired === true,
    gasTesting:
      gasTesting.length > 0
        ? gasTesting.map((item) => ({ gasTestingCatalogueId: item.gasTestingCatalogueId }))
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
    formResponses: Object.fromEntries((permit.formResponses ?? []).map((response) => [response.templateId, response.answers])),
    currentStep: draft?.currentStep ?? 0,
  };
}

export function shouldSaveExecutorPayload(roles: string[]): boolean {
  return roles.includes("operator") && !canRoleSubmitPermit(roles);
}

function optionalUuid(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

export function formToSavePayload(form: PermitFormState, options?: { executorOnly?: boolean }): DraftFields {
  const payload = {
    permitTypeId: form.permitTypeId,
    title: form.title,
    workScope: form.workScope || undefined,
    plantId: optionalUuid(form.plantId),
    departmentId: optionalUuid(form.departmentId),
    locationId: optionalUuid(form.locationId),
    workstationId: optionalUuid(form.workstationId),
    machineryId: optionalUuid(form.machineryId),
    plannedStartAt: form.plannedStartAt ? new Date(form.plannedStartAt).toISOString() : undefined,
    plannedEndAt: form.plannedEndAt ? new Date(form.plannedEndAt).toISOString() : undefined,
    currentStep: form.currentStep,
    hazards: form.hazards.filter((h) => h.hazardCategoryId.trim()),
    ppe: form.ppe.filter((p) => p.ppeCatalogueId.trim()),
    lototoRequired: form.lototoRequired,
    lototo: form.lototo.filter((item) => item.lototoPlanId.trim()),
    gasTestingRequired: form.gasTestingRequired,
    gasTesting: form.gasTesting.filter((item) => item.gasTestingCatalogueId.trim()),
    executors: form.executors.filter((e) => (e.workforceUserId ?? "").trim()),
    viewers: form.viewers.filter((e) => (e.workforceUserId ?? "").trim()),
    safetyOfficers: form.safetyOfficers.filter((e) => (e.workforceUserId ?? "").trim()),
    formResponses: Object.entries(form.formResponses).map(([templateId, answers]) => ({ templateId, answers })),
  };

  if (!options?.executorOnly) {
    return payload;
  }

  return {
    workstationId: payload.workstationId,
    machineryId: payload.machineryId,
    currentStep: payload.currentStep,
    hazards: payload.hazards,
    ppe: payload.ppe,
    lototoRequired: payload.lototoRequired,
    lototo: payload.lototo,
    gasTestingRequired: payload.gasTestingRequired,
    gasTesting: payload.gasTesting,
    executors: payload.executors,
    safetyOfficers: payload.safetyOfficers,
    formResponses: payload.formResponses,
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
    if (!form.departmentId.trim()) errors.push("Department is required");
    if (!form.locationId.trim()) errors.push("Location is required");
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
    if (!form.workstationId.trim()) {
      errors.push("Workstation is required");
    } else if (!form.machineryId.trim() && machinery.some((m) => m.workstationId === form.workstationId)) {
      errors.push("Machinery is required");
    }
    if (!form.hazards.some((h) => h.hazardCategoryId.trim())) {
      errors.push("At least one hazard is required");
    }
    if (!form.ppe.some((p) => p.ppeCatalogueId.trim())) {
      errors.push("At least one PPE item is required");
    }
    if (form.lototoRequired) {
      if (!form.machineryId.trim()) {
        errors.push("Machinery is required when LOTOTO is required");
      }
      if (!form.lototo.some((item) => item.lototoPlanId.trim())) {
        errors.push("Select at least one LOTOTO procedure");
      }
    }
    if (form.gasTestingRequired) {
      if (!form.gasTesting.some((item) => item.gasTestingCatalogueId.trim())) {
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

  return errors;
}
