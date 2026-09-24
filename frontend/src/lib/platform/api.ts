import { fetchApi } from "@/lib/api";

export type PlatformTenant = {
  id: string;
  tenantId: string;
  name: string;
  ownerEmail: string | null;
  status: string;
  createdAt: string;
  inviteStatus: string | null;
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

export const platformTenantsApi = {
  list: () => fetchApi<PlatformTenant[]>("/platform/tenants"),
  create: (payload: {
    organisationName: string;
    ownerEmail: string;
    ownerFirstName?: string;
    ownerLastName?: string;
  }) =>
    fetchApi<CreatedTenant>("/platform/tenants", {
      method: "POST",
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
