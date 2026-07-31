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

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|networkerror|load failed|econnrefused/i.test(error.message))
  );
}

async function parseBody(response: Response): Promise<{ success?: boolean; data?: unknown; error?: { message?: string; code?: string; details?: unknown } }> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as {
      success?: boolean;
      data?: unknown;
      error?: { message?: string; code?: string; details?: unknown };
    };
  } catch {
    throw new ApiError(
      response.ok ? "API returned an invalid response" : `API request failed (${response.status})`,
      "InvalidResponse",
    );
  }
}

export async function fetchApi<T>(
  path: string,
  init?: RequestInit,
  attempt = 0,
): Promise<T> {
  const token = getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    // Nest watch restarts briefly drop the API — retry once after a short wait.
    if (attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return fetchApi<T>(path, init, attempt + 1);
    }
    throw new ApiError(
      isNetworkFailure(error)
        ? "Cannot reach API. Confirm the API is running, then refresh."
        : error instanceof Error
          ? error.message
          : "API request failed",
      "NetworkError",
    );
  }

  const body = await parseBody(response);

  if (response.status === 401 && attempt < 2 && typeof window !== "undefined") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetchApi<T>(path, init, attempt + 1);
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
