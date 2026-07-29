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

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  const token = localStorage.getItem("ptw_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });

  const body = await response.json();
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
