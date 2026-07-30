const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080";
const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "ptw-platform";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const base = `${keycloakUrl}/realms/${realm}/protocol/openid-connect`;

export const authConfig = {
  keycloakUrl,
  realm,
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "ptw-web",
  appUrl,
  redirectUri: `${appUrl}/callback`,
  authorizationEndpoint: `${base}/auth`,
  tokenEndpoint: `${base}/token`,
};

export const PKCE_VERIFIER_KEY = "ptw_pkce_verifier";
export const AUTH_REDIRECT_KEY = "ptw_auth_redirect";
