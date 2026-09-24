export type WorkforceRecord = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  departmentId?: string | null;
  role?: string | null;
  executorKind?: "internal" | "contractor" | "agency";
};

export type CompetencyRecord = {
  id: string;
  name: string;
  workforceUserId?: string | null;
  expiryDate?: string | null;
  status?: string;
  description?: string | null;
};
