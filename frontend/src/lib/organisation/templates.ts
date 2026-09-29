import { fetchApi } from "@/lib/api";

/** Mirrors TemplateConfig in app/src/modules/organisation/permit-template-library.ts. */
export const TEMPLATE_FIELD_TYPES = [
  { value: "check", label: "Yes / No / Not applicable" },
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "select", label: "Choose one" },
  { value: "multiselect", label: "Choose several" },
  { value: "signature", label: "Name, date, time and signature" },
] as const;
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number]["value"];

/** Permit details a field can start from (mirrors TEMPLATE_PREFILL_SOURCES in the API). */
export const TEMPLATE_PREFILL_SOURCES = [
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "equipment", label: "Equipment (machinery)" },
  { value: "job-description", label: "Job title and scope" },
  { value: "valid-from", label: "Planned start date" },
  { value: "valid-to", label: "Planned end date" },
  { value: "crew-names", label: "Crew names" },
  { value: "crew-count", label: "Number in crew" },
] as const;
export type TemplatePrefillSource = (typeof TEMPLATE_PREFILL_SOURCES)[number]["value"];

export type TemplateField = {
  id: string;
  label: string;
  type: TemplateFieldType;
  required?: boolean;
  help?: string;
  unit?: string;
  options?: string[];
  prefill?: TemplatePrefillSource;
};
export type TemplateSection = { id: string; title: string; fields: TemplateField[] };
export type TemplateKind = "permit" | "check-sheet";
export type TemplateConfig = { kind: TemplateKind; reference?: string; declaration?: string; sections: TemplateSection[] };

export type PermitTemplate = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: "draft" | "published" | string;
  permitTypeIds: string[];
  /** Applies to every permit type, including types added later. */
  appliesToAllTypes: boolean;
  config: TemplateConfig | null;
  updatedAt: string;
};

export type PermitTemplateInput = Partial<Pick<PermitTemplate, "name" | "code" | "description" | "status" | "permitTypeIds" | "appliesToAllTypes">> & {
  config?: TemplateConfig;
};

export const KIND_LABEL: Record<TemplateKind, string> = { permit: "Permit form", "check-sheet": "Check sheet" };

export const permitTemplatesApi = {
  list: () => fetchApi<PermitTemplate[]>("/permit-templates"),
  get: (id: string) => fetchApi<PermitTemplate>(`/permit-templates/${id}`),
  create: (payload: PermitTemplateInput & { name: string }) =>
    fetchApi<PermitTemplate>("/permit-templates", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: PermitTemplateInput) =>
    fetchApi<PermitTemplate>(`/permit-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  duplicate: (id: string) => fetchApi<PermitTemplate>(`/permit-templates/${id}/duplicate`, { method: "POST" }),
  archive: (id: string) => fetchApi<void>(`/permit-templates/${id}`, { method: "DELETE" }),
  importReference: () =>
    fetchApi<{ created: number; alreadyPresent: number }>("/permit-templates/import-reference", { method: "POST" }),
};

export function fieldCount(config: TemplateConfig | null): number {
  return config?.sections.reduce((sum, section) => sum + section.fields.length, 0) ?? 0;
}

/** Short random id for new sections and fields; unique within a template is all that is needed. */
export function newId(prefix: string): string {
  // Not crypto.randomUUID: it is missing on plain-HTTP origins.
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
