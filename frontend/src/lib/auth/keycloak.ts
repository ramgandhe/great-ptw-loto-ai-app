import { authConfig, AUTH_REDIRECT_KEY, PKCE_VERIFIER_KEY } from "@/lib/auth/config";
import { generateCodeChallenge, generateCodeVerifier } from "@/lib/auth/pkce";
import { clearTokens, getRefreshToken, saveTokens } from "@/lib/auth/token-storage";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(authConfig.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json()) as TokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "Token exchange failed");
  }

  return payload;
}

export function storeAuthRedirect(path: string) {
  sessionStorage.setItem(AUTH_REDIRECT_KEY, path);
}

export function consumeAuthRedirect(): string {
  const path = sessionStorage.getItem(AUTH_REDIRECT_KEY);
  sessionStorage.removeItem(AUTH_REDIRECT_KEY);
  return path && path.startsWith("/") ? path : "/";
}

export async function startKeycloakLogin(redirectPath = "/"): Promise<void> {
  storeAuthRedirect(redirectPath);
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    response_type: "code",
    scope: "openid tenant",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.assign(`${authConfig.authorizationEndpoint}?${params.toString()}`);
}

export async function completeKeycloakLogin(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error("Missing PKCE verifier. Sign in again from the login page.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: authConfig.clientId,
    code,
    redirect_uri: authConfig.redirectUri,
    code_verifier: verifier,
  });

  const payload = await exchangeToken(body);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  saveTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  });
}

/** Single-flight refresh so parallel 401s don't burn a rotated refresh token. */
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: authConfig.clientId,
        refresh_token: refreshToken,
      });
      const payload = await exchangeToken(body);
      saveTokens({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token ?? refreshToken,
      });
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function signOut() {
  clearTokens();
  window.location.assign("/login");
}
