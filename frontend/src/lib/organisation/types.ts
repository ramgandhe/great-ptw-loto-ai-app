export type OrgRecord = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  approverRole?: string | null;
  isCurrent?: boolean;
  category?: string | null;
  severity?: string | null;
  status?: string;
  parentId?: string | null;
  plantId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  workstationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MachineryRecord = OrgRecord & {
  workstationId: string;
};

export type Organisation = OrgRecord & {
  legalName?: string | null;
  registrationNumber?: string | null;
  ownerEmail?: string | null;
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
  /** Static select options (used when `select` is not set). */
  options?: { value: string; label: string }[];
};
