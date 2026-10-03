import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiClient, onSessionEnded } from "@/lib/api/client";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "@/lib/auth/token-storage";

type Session = { accessToken: string; refreshToken: string };

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Throws ApiError with code PASSWORD_CHANGE_REQUIRED when a temporary password must be replaced (pass newPassword). */
  signIn: (email: string, password: string, newPassword?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Sign-in on the app's own screen: the API relays to Keycloak, as on the web. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    onSessionEnded(() => setIsAuthenticated(false));
    getAccessToken()
      .then((token) => setIsAuthenticated(Boolean(token)))
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string, newPassword?: string) => {
    const session = newPassword
      ? await apiClient.post<Session>("/auth/sign-in/new-password", { email, password, newPassword }, { auth: false })
      : await apiClient.post<Session>("/auth/sign-in", { email, password }, { auth: false });
    await saveTokens(session);
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    await clearTokens();
    setIsAuthenticated(false);
    // Ends the server session too; the app does not wait for it.
    if (refreshToken) void apiClient.post("/auth/sign-out", { refreshToken }, { auth: false }).catch(() => undefined);
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
