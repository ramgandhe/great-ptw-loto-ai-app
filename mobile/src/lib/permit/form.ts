import type { DraftFields, PermitDetail, PermitFormState } from "./types";

/** Same order and stored step index as the web editor's sections (0 work … 4 forms, 5 Safety Approval, 6 review). */
export const PERMIT_WIZARD_STEPS = [
  "Work",
  "Place and time",
  "Safety",
  "Crew",
  "Check sheets",
  "Safety Approval",
  "Review",
] as const;

export function fromStoredStep(stored: number): number {
  return Math.min(Math.max(stored, 0), PERMIT_WIZARD_STEPS.length - 1);
}

export function toStoredStep(step: number): number {
  return fromStoredStep(step);
}

/**
 * Stored instants are UTC; form fields hold local "YYYY-MM-DDTHH:mm" (converted back with
 * toISOString on save). Slicing the UTC string would shift the time by the UTC offset on every save.
 */
export function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createEmptyPermitForm(): PermitFormState {
  return {
    permitTypeId: "",
    title: "",
    workScope: "",
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
    lototoRequired: false,
    plannedStartAt: "",
    plannedEndAt: "",
    hazards: [{ hazardCategoryId: "", extraConsequences: [], extraControls: [], omittedConsequences: [], omittedControls: [] }],
    ppe: [{ ppeCatalogueId: "", quantity: 1 }],
    lototo: [],
    gasTestingRequired: false,
    gasTesting: [],
    executors: [{ workforceUserId: "", isPrimary: true }],
    safetyOfficers: [],
    safetyApprovalComment: "",
    safetyApprovalSignedName: "",
    formResponses: {},
    currentStep: 0,
  };
}

export function permitDetailToForm(detail: PermitDetail): PermitFormState {
  const { permit, draft, hazards, ppe, lototo = [], gasTesting = [], executors } = detail;
  const assetIds = (detail.assets ?? []).map((row) => row.assetId).filter(Boolean);

  return {
    permitTypeId: permit.permitTypeId,
    title: permit.title,
    workScope: permit.workScope ?? "",
    emergencyPhone: permit.emergencyPhone ?? "",
    plantId: permit.plantId ?? "",
    departmentId: permit.departmentId ?? "",
    locationId: permit.locationId ?? "",
    workstationId: permit.workstationId ?? "",
    machineryId: permit.machineryId ?? "",
    siteId: permit.siteId ?? permit.plantId ?? "",
    workLocationId: permit.workLocationId ?? permit.locationId ?? "",
    exactSpot: permit.exactSpot ?? "",
    assetIds: assetIds.length > 0 ? assetIds : permit.machineryId ? [permit.machineryId] : [],
    gasReady: true,
    lototoRequired: permit.lototoRequired === true,
    plannedStartAt: toDateInputValue(permit.plannedStartAt),
    plannedEndAt: toDateInputValue(permit.plannedEndAt),
    hazards:
      hazards.length > 0
        ? hazards.map((h) => ({
            hazardCategoryId: h.hazardCategoryId,
            extraConsequences: h.extraConsequences ?? [],
            extraControls: h.extraControls ?? [],
            omittedConsequences: h.omittedConsequences ?? [],
            omittedControls: h.omittedControls ?? [],
          }))
        : [{ hazardCategoryId: "", extraConsequences: [], extraControls: [], omittedConsequences: [], omittedControls: [] }],
    ppe:
      ppe.length > 0
        ? ppe.map((item) => ({
            ppeCatalogueId: item.ppeCatalogueId,
            quantity: item.quantity ?? 1,
          }))
        : [{ ppeCatalogueId: "", quantity: 1 }],
    lototo:
      lototo.length > 0
        ? lototo.map((item) => ({
            procedureId: item.procedureId,
            extraPoints: [],
            stepNa: [],
            crew: [],
            verifiers: [],
          }))
        : [],
    gasTestingRequired: permit.gasTestingRequired === true,
    gasTesting:
      gasTesting.length > 0
        ? gasTesting.map((item) => ({
            gasTestingCatalogueId: item.gasTestingCatalogueId ?? undefined,
            parameter: item.parameter,
            unit: item.unit,
            minimum: item.minimum,
            maximum: item.maximum,
            removedReason: item.removedReason ?? undefined,
            sourceName: item.sourceName,
          }))
        : [],
    executors:
      executors.length > 0
        ? executors.map((e) => ({
            workforceUserId: e.workforceUserId,
            isPrimary: e.isPrimary ?? false,
          }))
        : [{ workforceUserId: "", isPrimary: true }],
    safetyOfficers: (detail.safetyOfficers ?? []).map((row) => ({ workforceUserId: row.workforceUserId })),
    safetyApprovalComment: permit.safetyApprovalComment ?? "",
    safetyApprovalSignedName: permit.safetyApprovalSignedName ?? "",
    formResponses: Object.fromEntries((permit.formResponses ?? []).map((response) => [response.templateId, response.answers])),
    currentStep: fromStoredStep(draft?.currentStep ?? 0),
  };
}

function optionalUuid(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

function canRoleSubmitPermit(roles: string[]): boolean {
  return (
    roles.includes("permit-receiver") ||
    roles.includes("tenant-owner") ||
    roles.includes("tenant-admin") ||
    roles.includes("platform-admin")
  );
}

export function shouldSaveExecutorPayload(roles: string[]): boolean {
  return roles.includes("permit-operator") && !canRoleSubmitPermit(roles);
}

export function formToSavePayload(form: PermitFormState, options?: { executorOnly?: boolean }): DraftFields {
  const payload = {
    permitTypeId: form.permitTypeId,
    title: form.title,
    workScope: form.workScope || undefined,
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
    lototoRequired: form.lototoRequired,
    plannedStartAt: form.plannedStartAt ? new Date(form.plannedStartAt).toISOString() : undefined,
    plannedEndAt: form.plannedEndAt ? new Date(form.plannedEndAt).toISOString() : undefined,
    currentStep: toStoredStep(form.currentStep),
    hazards: form.hazards.filter((h) => h.hazardCategoryId.trim()),
    ppe: form.ppe.filter((p) => p.ppeCatalogueId.trim()),
    lototo: form.lototo.filter((item) => item.procedureId.trim()),
    gasTestingRequired: form.gasTestingRequired,
    gasTesting: form.gasTesting.filter((item) => (item.gasTestingCatalogueId ?? "").trim() || (item.parameter ?? "").trim()),
    executors: form.executors.filter((e) => (e.workforceUserId ?? "").trim()),
    formResponses: Object.entries(form.formResponses).map(([templateId, answers]) => ({ templateId, answers })),
  };

  if (!options?.executorOnly) {
    return payload;
  }

  return {
    assetIds: payload.assetIds,
    currentStep: payload.currentStep,
    hazards: payload.hazards,
    ppe: payload.ppe,
    lototoRequired: payload.lototoRequired,
    lototo: payload.lototo,
    gasTestingRequired: payload.gasTestingRequired,
    gasTesting: payload.gasTesting,
    executors: payload.executors,
    formResponses: payload.formResponses,
  };
}

export function validateStep(form: PermitFormState, step: number): string[] {
  const errors: string[] = [];

  if (step === 0) {
    if (!form.permitTypeId.trim()) errors.push("Permit type is required");
    if (!form.title.trim()) errors.push("Title is required");
  }

  if (step === 1) {
    if (!form.siteId.trim()) errors.push("Site is required");
    if (!form.workLocationId.trim()) errors.push("Work location is required");
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
      if (form.assetIds.length === 0) {
        errors.push("An asset is required when LOTOTO is required");
      }
      if (!form.lototo.some((item) => item.procedureId.trim())) {
        errors.push("Select at least one LOTOTO procedure");
      }
    }
    if (
      form.gasTestingRequired &&
      !form.gasTesting.some((item) => !item.removedReason?.trim() && ((item.gasTestingCatalogueId ?? "").trim() || (item.parameter ?? "").trim()))
    ) {
      errors.push("Select at least one gas testing item");
    }
  }

  if (step === 3) {
    if (!form.executors.some((e) => (e.workforceUserId ?? "").trim())) {
      errors.push("At least one executor is required");
    }
  }

  if (step === 5 && form.safetyOfficers.some((row) => row.workforceUserId.trim())) {
    if (!form.safetyApprovalComment.trim()) errors.push("Safety Approval comments are required");
    if (!form.safetyApprovalSignedName.trim()) errors.push("A typed name is required for Safety Approval");
  }

  return errors;
}
