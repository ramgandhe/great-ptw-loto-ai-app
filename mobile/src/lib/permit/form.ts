import type { PermitDetail, PermitFormState } from "./types";

export const PERMIT_WIZARD_STEPS = [
  "Basic",
  "Location",
  "Hazards & PPE",
  "Executors",
  "Review",
] as const;

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
    lototoRequired: false,
    plannedStartAt: "",
    plannedEndAt: "",
    hazards: [{ hazardCategoryId: "", description: "" }],
    ppe: [{ ppeCatalogueId: "", quantity: 1 }],
    lototo: [],
    gasTestingRequired: false,
    gasTesting: [],
    executors: [{ workforceUserId: "", isPrimary: true }],
    currentStep: 0,
  };
}

export function permitDetailToForm(detail: PermitDetail): PermitFormState {
  const { permit, draft, hazards, ppe, lototo = [], gasTesting = [], executors } = detail;

  return {
    permitTypeId: permit.permitTypeId,
    title: permit.title,
    workScope: permit.workScope ?? "",
    plantId: permit.plantId ?? "",
    departmentId: permit.departmentId ?? "",
    locationId: permit.locationId ?? "",
    workstationId: permit.workstationId ?? "",
    machineryId: permit.machineryId ?? "",
    lototoRequired: permit.lototoRequired === true,
    plannedStartAt: permit.plannedStartAt?.slice(0, 16) ?? "",
    plannedEndAt: permit.plannedEndAt?.slice(0, 16) ?? "",
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
            workforceUserId: e.workforceUserId,
            isPrimary: e.isPrimary ?? false,
          }))
        : [{ workforceUserId: "", isPrimary: true }],
    currentStep: draft?.currentStep ?? 0,
  };
}

function optionalUuid(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

function canRoleSubmitPermit(roles: string[]): boolean {
  return (
    roles.includes("job-issuer") ||
    roles.includes("tenant-owner") ||
    roles.includes("tenant-admin") ||
    roles.includes("platform-admin")
  );
}

export function shouldSaveExecutorPayload(roles: string[]): boolean {
  return roles.includes("operator") && !canRoleSubmitPermit(roles);
}

export function formToSavePayload(form: PermitFormState, options?: { executorOnly?: boolean }) {
  const payload = {
    permitTypeId: form.permitTypeId,
    title: form.title,
    workScope: form.workScope || undefined,
    plantId: optionalUuid(form.plantId),
    departmentId: optionalUuid(form.departmentId),
    locationId: optionalUuid(form.locationId),
    workstationId: optionalUuid(form.workstationId),
    machineryId: optionalUuid(form.machineryId),
    lototoRequired: form.lototoRequired,
    plannedStartAt: form.plannedStartAt ? new Date(form.plannedStartAt).toISOString() : undefined,
    plannedEndAt: form.plannedEndAt ? new Date(form.plannedEndAt).toISOString() : undefined,
    currentStep: form.currentStep,
    hazards: form.hazards.filter((h) => h.hazardCategoryId.trim()),
    ppe: form.ppe.filter((p) => p.ppeCatalogueId.trim()),
    lototo: form.lototo.filter((item) => item.lototoPlanId.trim()),
    gasTestingRequired: form.gasTestingRequired,
    gasTesting: form.gasTesting.filter((item) => item.gasTestingCatalogueId.trim()),
    executors: form.executors.filter((e) => (e.workforceUserId ?? "").trim()),
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
    if (!form.plannedStartAt) errors.push("Planned start is required");
    if (!form.plannedEndAt) errors.push("Planned end is required");
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
