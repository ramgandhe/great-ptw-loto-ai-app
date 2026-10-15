import { fetchApi } from "@/lib/api";

export type PlatformTenant = {
  id: string;
  tenantId: string;
  name: string;
  ownerEmail: string | null;
  status: string;
  createdAt: string;
  inviteStatus: string | null;
  about: string | null;
  industryId: string;
  industryName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  addressState: string | null;
  addressCountry: string | null;
  addressPin: string | null;
};

export type Industry = {
  id: string;
  name: string;
  isFallback: boolean;
};

export type TenantProfile = {
  organisationName: string;
  about?: string;
  industryId: string;
  addressLine1: string;
  addressLine2?: string;
  state: string;
  country: string;
  pin: string;
};

export type CreatedTenant = {
  organisation: {
    id: string;
    tenantId: string;
    name: string;
    ownerEmail: string | null;
    status: string;
  };
  ownerEmail: string;
  inviteStatus: string;
  joinUrl: string;
  temporaryPassword: string;
  signInHint: string;
};

export type PublicTenantInvite = {
  status: string;
  ownerEmail: string;
  organisationName: string;
};

export const SITE_COUNT_OPTIONS = ["1", "2-5", "6-20", "20+"] as const;

export type AccessRequestPayload = {
  fullName: string;
  workEmail: string;
  phone?: string;
  companyName: string;
  jobTitle?: string;
  siteCount?: (typeof SITE_COUNT_OPTIONS)[number];
  message?: string;
  consent: boolean;
};

export type AccessRequest = Omit<AccessRequestPayload, "consent"> & {
  id: string;
  status: string;
  createdAt: string;
  consentedAt: string;
};

export const accessRequestsApi = {
  submit: (payload: AccessRequestPayload) =>
    fetchApi<{ id: string; status: "received" }>("/access-requests", {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    }),
  list: () => fetchApi<AccessRequest[]>("/platform/access-requests"),
};

export const platformTenantsApi = {
  list: () => fetchApi<PlatformTenant[]>("/platform/tenants"),
  create: (payload: TenantProfile & {
    ownerEmail: string;
    ownerFirstName?: string;
    ownerLastName?: string;
  }) =>
    fetchApi<CreatedTenant>("/platform/tenants", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: TenantProfile) =>
    fetchApi<PlatformTenant>(`/platform/tenants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getInvite: (token: string) =>
    fetchApi<PublicTenantInvite>(`/platform/tenant-invites/${token}`, { skipAuth: true }),
  acceptInvite: (token: string) =>
    fetchApi<{ status: string; organisationId: string }>(`/platform/tenant-invites/${token}/accept`, {
      method: "POST",
    }),
  disable: (id: string) =>
    fetchApi<PlatformTenant>(`/platform/tenants/${id}/disable`, { method: "POST" }),
  enable: (id: string) =>
    fetchApi<PlatformTenant>(`/platform/tenants/${id}/enable`, { method: "POST" }),
  remove: (id: string) =>
    fetchApi<{ id: string; deleted: boolean }>(`/platform/tenants/${id}`, { method: "DELETE" }),
};

export type DefaultLocationType = {
  id: string;
  name: string;
  description: string | null;
};

export type DefaultPpeCategory = {
  id: string;
  name: string;
  isFallback: boolean;
};

export type DefaultPpeItem = {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
};

export type DefaultPermitType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
};

const defaults = "/platform/defaults";

export const platformDefaultsApi = {
  locationTypes: () => fetchApi<DefaultLocationType[]>(`${defaults}/location-types`),
  createLocationType: (body: { name: string; description?: string }) =>
    fetchApi<DefaultLocationType>(`${defaults}/location-types`, { method: "POST", body: JSON.stringify(body) }),
  updateLocationType: (id: string, body: { name: string; description?: string }) =>
    fetchApi<DefaultLocationType>(`${defaults}/location-types/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  removeLocationType: (id: string) =>
    fetchApi<{ id: string; deleted: boolean }>(`${defaults}/location-types/${id}`, { method: "DELETE" }),

  ppeCategories: () => fetchApi<DefaultPpeCategory[]>(`${defaults}/ppe-categories`),
  createPpeCategory: (name: string) =>
    fetchApi<DefaultPpeCategory>(`${defaults}/ppe-categories`, { method: "POST", body: JSON.stringify({ name }) }),
  updatePpeCategory: (id: string, name: string) =>
    fetchApi<DefaultPpeCategory>(`${defaults}/ppe-categories/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  removePpeCategory: (id: string, force = false) =>
    fetchApi<{ id: string; deleted: boolean }>(`${defaults}/ppe-categories/${id}${force ? "?force=true" : ""}`, {
      method: "DELETE",
    }),

  ppeItems: () => fetchApi<DefaultPpeItem[]>(`${defaults}/ppe-items`),
  createPpeItem: (body: { code: string; name: string; categoryId: string; description?: string }) =>
    fetchApi<DefaultPpeItem>(`${defaults}/ppe-items`, { method: "POST", body: JSON.stringify(body) }),
  updatePpeItem: (id: string, body: { code: string; name: string; categoryId: string; description?: string }) =>
    fetchApi<DefaultPpeItem>(`${defaults}/ppe-items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  removePpeItem: (id: string) =>
    fetchApi<{ id: string; deleted: boolean }>(`${defaults}/ppe-items/${id}`, { method: "DELETE" }),

  energySources: () => fetchApi<DefaultPpeCategory[]>(`${defaults}/energy-sources`),
  createEnergySource: (name: string) =>
    fetchApi<DefaultPpeCategory>(`${defaults}/energy-sources`, { method: "POST", body: JSON.stringify({ name }) }),
  updateEnergySource: (id: string, name: string) =>
    fetchApi<DefaultPpeCategory>(`${defaults}/energy-sources/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  removeEnergySource: (id: string) =>
    fetchApi<{ id: string; deleted: boolean }>(`${defaults}/energy-sources/${id}`, { method: "DELETE" }),

  permitTypes: () => fetchApi<DefaultPermitType[]>(`${defaults}/permit-types`),
  createPermitType: (body: { code: string; name: string; description?: string; color: string }) =>
    fetchApi<DefaultPermitType>(`${defaults}/permit-types`, { method: "POST", body: JSON.stringify(body) }),
  updatePermitType: (id: string, body: { code: string; name: string; description?: string; color: string }) =>
    fetchApi<DefaultPermitType>(`${defaults}/permit-types/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  removePermitType: (id: string) =>
    fetchApi<{ id: string; deleted: boolean }>(`${defaults}/permit-types/${id}`, { method: "DELETE" }),
};

export const industriesApi = {
  list: () => fetchApi<Industry[]>("/platform/industries"),
  create: (name: string) =>
    fetchApi<Industry>("/platform/industries", { method: "POST", body: JSON.stringify({ name }) }),
  update: (id: string, name: string) =>
    fetchApi<Industry>(`/platform/industries/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  remove: (id: string, force = false) =>
    fetchApi<{ id: string; deleted: boolean }>(`/platform/industries/${id}${force ? "?force=true" : ""}`, {
      method: "DELETE",
    }),
};
