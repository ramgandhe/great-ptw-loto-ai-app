import { fetchApi } from "@/lib/api";

export type UserProfile = {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  tenantId?: string;
};

export function getProfile() {
  return fetchApi<UserProfile>("/auth/profile");
}
