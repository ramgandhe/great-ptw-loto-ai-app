import type { PermitDetail, PermitFormState } from "./types";

export const PERMIT_WIZARD_STEPS = [
  "Basic information",
  "Location & schedule",
  "Hazards & PPE",
  "Executors",
  "Review & submit",
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
    plannedStartAt: "",
    plannedEndAt: "",
    hazards: [{ hazardCategoryId: "", description: "" }],
    ppe: [{ ppeCatalogueId: "", quantity: 1 }],
    executors: [{ workforceUserId: "", isPrimary: true }],
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
  const { permit, draft, hazards, ppe, executors } = detail;

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
    executors:
      executors.length > 0
        ? executors.map((e) => ({
            workforceUserId: e.workforceUserId ?? "",
            isPrimary: e.isPrimary ?? false,
          }))
        : [{ workforceUserId: "", isPrimary: true }],
    currentStep: draft?.currentStep ?? 0,
  };
}

function optionalUuid(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

export function formToSavePayload(form: PermitFormState) {
  return {
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
    executors: form.executors.filter((e) => (e.workforceUserId ?? "").trim()),
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
  }

  if (step === 2) {
    if (!form.hazards.some((h) => h.hazardCategoryId.trim())) {
      errors.push("At least one hazard is required");
    }
    if (!form.ppe.some((p) => p.ppeCatalogueId.trim())) {
      errors.push("At least one PPE item is required");
    }
  }

  if (step === 3) {
    if (!form.executors.some((e) => (e.workforceUserId ?? "").trim())) {
      errors.push("At least one executor is required");
    }
  }

  return errors;
}
