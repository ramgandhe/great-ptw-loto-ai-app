import { fetchApi, getApiBaseUrl, ApiError } from "@/lib/api";

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

  const token =
    typeof window !== "undefined" ? localStorage.getItem("ptw_access_token") : null;

  const response = await fetch(`${getApiBaseUrl()}/auth/profile/avatar`, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new ApiError(
      body.error?.message ?? "Profile picture upload failed",
      body.error?.code,
      body.error?.details,
    );
  }

  return body.data as UserProfile;
}
