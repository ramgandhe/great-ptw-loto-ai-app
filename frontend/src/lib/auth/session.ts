import { ApiError, getApiBaseUrl } from "@/lib/api";
import { clearTokens, getRefreshToken, saveTokens } from "@/lib/auth/token-storage";

/**
 * Sign-in on the app's own page. The API relays to Keycloak server to server, so people never
 * see a second login screen or the identity server's address.
 */
type Session = { accessToken: string; refreshToken: string };

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ success: false, error: { message: `The server answered ${response.status}.` } }));
  if (!response.ok || payload.success === false) {
    throw new ApiError(payload.error?.message ?? "Sign-in failed", payload.error?.code);
  }
  return payload.data as T;
}

/** Signs in and keeps the tokens. Throws ApiError with code PASSWORD_CHANGE_REQUIRED for temporary passwords. */
export async function signIn(email: string, password: string) {
  saveTokens(await post<Session>("/auth/sign-in", { email, password }));
}

/** First sign-in: swaps the temporary password for the person's own, then signs in. */
export async function setFirstPassword(email: string, password: string, newPassword: string) {
  saveTokens(await post<Session>("/auth/sign-in/new-password", { email, password, newPassword }));
}

/** Emails a one-time reset link if the address has an account; the answer is the same either way. */
export async function requestPasswordReset(email: string) {
  await post("/auth/password-reset", { email });
}

/** Uses the emailed link, sets the new password and signs in. */
export async function completePasswordReset(token: string, newPassword: string) {
  saveTokens(await post<Session>("/auth/password-reset/complete", { token, newPassword }));
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    saveTokens(await post<Session>("/auth/session/refresh", { refreshToken }));
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export function signOut() {
  const refreshToken = getRefreshToken();
  clearTokens();
  // Ends the server session too; the page does not wait for it.
  if (refreshToken) void post("/auth/sign-out", { refreshToken }).catch(() => undefined);
  window.location.assign("/login");
}
