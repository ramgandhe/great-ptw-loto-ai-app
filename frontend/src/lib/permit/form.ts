import type { PermitDetail, PermitFormState, SaveDraftPayload } from "./types";

export type WizardParticipant = "job-issuer" | "operator";

export const PERMIT_WIZARD_STEPS = [
  { label: "Basic information", owner: "job-issuer" satisfies WizardParticipant },
  { label: "Location & schedule", owner: "job-issuer" satisfies WizardParticipant },
  { label: "On-site details", owner: "operator" satisfies WizardParticipant },
  { label: "Crew assignment", owner: "operator" satisfies WizardParticipant },
  { label: "Review & submit", owner: "job-issuer" satisfies WizardParticipant },
] as const;

export function getWizardStepOwner(step: number): WizardParticipant {
  return PERMIT_WIZARD_STEPS[step]?.owner ?? "job-issuer";
}

export function canRoleEditWizardStep(roles: string[], step: number): boolean {
  const owner = getWizardStepOwner(step);
  const privileged =
    roles.includes("tenant-owner") || roles.includes("tenant-admin") || roles.includes("platform-admin");
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
    currentStep: 0,
  };
}

function toDateInputValue(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.slice(0, 16);
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
    currentStep: draft?.currentStep ?? 0,
  };
}

export function shouldSaveExecutorPayload(roles: string[]): boolean {
  return roles.includes("operator") && !canRoleSubmitPermit(roles);
}

function optionalUuid(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

export function formToSavePayload(form: PermitFormState, options?: { executorOnly?: boolean }): SaveDraftPayload {
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
  };
}

export function validateStep(form: PermitFormState, step: number): string[] {
  const errors: string[] = [];

  if (step === 0) {
    if (!form.permitTypeId.trim()) errors.push("Permit type is required");
    if (!form.title.trim()) errors.push("Title is required");
  }

  if (step === 1) {
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
      if (!form.workstationId.trim()) {
        errors.push("Workstation is required when gas testing is required");
      }
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

  return errors;
}
