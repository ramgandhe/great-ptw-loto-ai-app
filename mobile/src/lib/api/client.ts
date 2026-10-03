import type { ApiErrorResponse, ApiResponse } from "@ptw/shared";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "@/lib/auth/token-storage";
import { apiConfig } from "./config";
import { ApiError } from "./errors";

export { ApiError } from "./errors";

export interface FetchApiOptions extends RequestInit {
  token?: string;
  auth?: boolean;
}

let sessionEnded: () => void = () => undefined;

/** Called when the session can no longer be refreshed, so the app returns to sign-in. */
export function onSessionEnded(listener: () => void) {
  sessionEnded = listener;
}

let refreshing: Promise<boolean> | null = null;

/** Swaps the refresh token for a new access token; one refresh at a time, shared by waiting requests. Throws when offline. */
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;
    try {
      await saveTokens(await fetchApi<{ accessToken: string; refreshToken: string }>("/auth/session/refresh", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ refreshToken }),
      }));
      return true;
    } catch (error) {
      // The server refused the refresh token: the session is over. No connection is not a refusal.
      if (error instanceof ApiError) return false;
      throw error;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function fetchApi<T>(path: string, options: FetchApiOptions = {}, retried = false): Promise<T> {
  const { token, auth = true, headers, ...init } = options;
  const accessToken = auth ? (token ?? (await getAccessToken()) ?? undefined) : undefined;

  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  // An expired access token: refresh once and repeat the request; if that fails, sign in again.
  if (response.status === 401 && accessToken && !token && !retried) {
    if (await refreshSession()) return fetchApi<T>(path, options, true);
    await clearTokens();
    sessionEnded();
  }

  let body: ApiResponse<T> | ApiErrorResponse;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("Invalid API response", "INVALID_RESPONSE", response.status);
  }

  if (!response.ok || body.success === false) {
    const error = "error" in body ? body.error : undefined;
    throw new ApiError(
      error?.message ?? "API request failed",
      error?.code,
      response.status,
      error?.details,
    );
  }

  return body.data;
}

export function getApiBaseUrl(): string {
  return apiConfig.baseUrl;
}

export const apiClient = {
  get<T>(path: string, options?: FetchApiOptions) {
    return fetchApi<T>(path, { ...options, method: "GET" });
  },
  post<T>(path: string, data?: unknown, options?: FetchApiOptions) {
    return fetchApi<T>(path, {
      ...options,
      method: "POST",
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  },
  patch<T>(path: string, data?: unknown, options?: FetchApiOptions) {
    return fetchApi<T>(path, {
      ...options,
      method: "PATCH",
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  },
  delete<T>(path: string, options?: FetchApiOptions) {
    return fetchApi<T>(path, { ...options, method: "DELETE" });
  },
};
