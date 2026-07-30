export type OrgRecord = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  status?: string;
  parentId?: string | null;
  plantId?: string | null;
  departmentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Organisation = OrgRecord & {
  legalName?: string | null;
  registrationNumber?: string | null;
};

export type NotificationPreference = OrgRecord & {
  channel?: string | null;
  eventType?: string | null;
  enabled?: boolean;
};

export type EntityField = {
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
};
