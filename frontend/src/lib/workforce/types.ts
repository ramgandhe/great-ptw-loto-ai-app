export type WorkforceRecord = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  departmentId?: string | null;
  agencyId?: string | null;
  role?: string | null;
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

export type EntityField = {
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
};
