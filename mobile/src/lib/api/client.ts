import type { ApiResponse } from "@ptw/shared";
import { getAccessToken } from "@/lib/auth/token-storage";
import { apiConfig } from "./config";
import { ApiError } from "./errors";

export { ApiError } from "./errors";

export interface FetchApiOptions extends RequestInit {
  token?: string;
  auth?: boolean;
}

export async function fetchApi<T>(path: string, options: FetchApiOptions = {}): Promise<T> {
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

  let body: ApiResponse<T> | { success: false; error: { code: string; message: string } };
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
