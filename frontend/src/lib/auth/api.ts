import { fetchApi } from "@/lib/api";

export type UserProfile = {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  roles: string[];
  tenantId?: string;
};

export function getProfile() {
  return fetchApi<UserProfile>("/auth/profile");
}

export function updateProfile(payload: { displayName: string }) {
  return fetchApi<UserProfile>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function uploadProfileAvatar(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return fetchApi<UserProfile>(`/auth/profile/avatar`, { method: "POST", body: formData });
}

export function removeProfileAvatar() {
  return fetchApi<UserProfile>("/auth/profile/avatar", { method: "DELETE" });
}
