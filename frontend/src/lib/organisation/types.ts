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

export type MachineryRecord = OrgRecord & {
  workstationId: string;
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

import type { EntitySelectResource } from "@/lib/form-options";

export type EntityField = {
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
  select?: EntitySelectResource;
};
