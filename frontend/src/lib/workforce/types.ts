export type WorkforceRecord = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  departmentId?: string | null;
  agencyId?: string | null;
  role?: string | null;
  executorKind?: "internal" | "contractor" | "agency";
  createdAt?: string;
  updatedAt?: string;
};

export type CompetencyRecord = {
  id: string;
  name: string;
  workforceUserId?: string | null;
  certificationName?: string | null;
  expiryDate?: string | null;
  status?: string;
  description?: string | null;
};

export type TenantUser = {
  id: string;
  email: string | null;
  username: string;
  name?: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  roles: string[];
  departmentId?: string | null;
  executorKind?: "internal" | "contractor" | "agency";
};

export type CreatedTenantUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  temporaryPassword: string;
  signInUrl: string;
  signInHint: string;
};

export type EntityField = {
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
  select?: import("@/lib/form-options").EntitySelectResource;
};
