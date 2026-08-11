"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getProfile, type UserProfile } from "@/lib/auth/api";

type AuthProfileContextValue = {
  profile: UserProfile | null;
  roles: string[];
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthProfileContext = createContext<AuthProfileContextValue | null>(null);

export function AuthProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await getProfile();
      setProfile(nextProfile);
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : "Failed to load user profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthProfileContextValue>(
    () => ({
      profile,
      roles: profile?.roles ?? [],
      isLoading,
      error,
      refreshProfile,
    }),
    [profile, isLoading, error, refreshProfile],
  );

  return <AuthProfileContext.Provider value={value}>{children}</AuthProfileContext.Provider>;
}

export function useAuthProfile() {
  const context = useContext(AuthProfileContext);
  if (!context) {
    throw new Error("useAuthProfile must be used within AuthProfileProvider");
  }
  return context;
}
