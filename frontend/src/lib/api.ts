import { refreshAccessToken } from "@/lib/auth/keycloak";
import { clearTokens, getAccessToken } from "@/lib/auth/token-storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  code?: string;
  details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

export async function fetchApi<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const body = await response.json();

  if (response.status === 401 && !retried && typeof window !== "undefined") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchApi<T>(path, init, true);
    }

    clearTokens();
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    throw new ApiError("Session expired. Redirecting to sign in…", "Unauthorized");
  }

  if (!response.ok || body.success === false) {
    throw new ApiError(
      body.error?.message ?? "API request failed",
      body.error?.code,
      body.error?.details,
    );
  }

  return body.data as T;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
