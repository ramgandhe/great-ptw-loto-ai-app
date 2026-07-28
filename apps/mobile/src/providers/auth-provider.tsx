import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { authConfig, getAuthDiscovery } from "@/lib/auth/config";
import { clearTokens, getAccessToken, saveTokens } from "@/lib/auth/token-storage";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const discovery = getAuthDiscovery();
const redirectUri = AuthSession.makeRedirectUri({ scheme: "ptw", path: "callback" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: authConfig.clientId,
      redirectUri,
      scopes: ["openid", "profile"],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    getAccessToken()
      .then((token) => setIsAuthenticated(Boolean(token)))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (response?.type !== "success" || !request) {
      return;
    }

    const code = response.params.code;
    if (!code) {
      return;
    }

    AuthSession.exchangeCodeAsync(
      {
        clientId: authConfig.clientId,
        code,
        redirectUri,
        extraParams: {
          code_verifier: request.codeVerifier ?? "",
        },
      },
      discovery,
    )
      .then(async (tokenResult) => {
        if (!tokenResult.accessToken) {
          throw new Error("Missing access token");
        }
        await saveTokens({
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
        });
        setIsAuthenticated(true);
      })
      .catch((error) => {
        console.error("Keycloak token exchange failed", error);
      });
  }, [request, response]);

  const signIn = useCallback(async () => {
    await promptAsync();
  }, [promptAsync]);

  const signOut = useCallback(async () => {
    await clearTokens();
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, isLoading, signIn, signOut }),
    [isAuthenticated, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
