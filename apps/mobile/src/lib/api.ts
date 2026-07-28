const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function fetchApi<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.error?.message ?? "API request failed");
  }

  return body.data as T;
}
