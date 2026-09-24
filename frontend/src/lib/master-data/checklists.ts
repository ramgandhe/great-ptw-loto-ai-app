import { fetchApi } from "@/lib/api";

export type SafetyChecklistItem = {
  id: string;
  checklistId: string;
  sequence: number;
  description: string;
  isMandatory: boolean;
};

export type SafetyChecklist = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status?: string;
};

export type SafetyChecklistBundle = {
  checklist: SafetyChecklist;
  items: SafetyChecklistItem[];
};

export const checklistsApi = {
  list: () => fetchApi<SafetyChecklistBundle[]>("/checklists"),
  create: (payload: {
    code: string;
    name: string;
    description?: string;
    items: { description: string; isMandatory: boolean }[];
  }) =>
    fetchApi<SafetyChecklistBundle>("/checklists", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    payload: {
      code?: string;
      name?: string;
      description?: string;
      items?: { description: string; isMandatory: boolean }[];
    },
  ) =>
    fetchApi<SafetyChecklistBundle>(`/checklists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  archive: (id: string) => fetchApi<SafetyChecklist>(`/checklists/${id}`, { method: "DELETE" }),
};
