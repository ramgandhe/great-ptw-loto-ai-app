"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startKeycloakLogin } from "@/lib/auth/keycloak";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = searchParams.get("next") ?? "/";

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await startKeycloakLogin(next);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not start sign in.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You will be redirected to Keycloak in this tab to sign in.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className={cn(buttonVariants(), "w-full")}
      >
        {loading ? "Redirecting…" : "Continue with Keycloak"}
      </button>
      <p className="text-xs text-muted-foreground">
        Keycloak must be running at{" "}
        <code className="rounded bg-muted px-1">http://localhost:8080</code>. Use{" "}
        <strong>admin@ptw.local</strong> / <strong>admin</strong>.
      </p>
    </div>
  );
}
