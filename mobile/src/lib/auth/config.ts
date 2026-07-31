export const authConfig = {
  keycloakUrl: process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080",
  realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? "ptw-platform",
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? "ptw-mobile",
};

export function getAuthDiscovery() {
  const base = `${authConfig.keycloakUrl}/realms/${authConfig.realm}/protocol/openid-connect`;
  return {
    authorizationEndpoint: `${base}/auth`,
    tokenEndpoint: `${base}/token`,
    revocationEndpoint: `${base}/logout`,
  };
}
