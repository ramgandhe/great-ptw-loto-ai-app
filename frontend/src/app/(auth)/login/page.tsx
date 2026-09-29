"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { BackLink } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { startKeycloakLogin } from "@/lib/auth/keycloak";

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = searchParams.get("next") ?? "/dashboard";

  async function handleLogin(forceLogin = false) {
    setError(null);
    setLoading(true);
    try {
      await startKeycloakLogin(next, { forceLogin });
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not start sign in.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/" label="Back to home" />
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You will be redirected to Keycloak in this tab to sign in.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="button"
        onClick={() => handleLogin(false)}
        disabled={loading}
        className={cn(buttonVariants(), "w-full")}
      >
        {loading ? "Redirecting…" : "Continue with Keycloak"}
      </button>
      <button
        type="button"
        onClick={() => handleLogin(true)}
        disabled={loading}
        className={cn(buttonVariants({ variant: "outline" }), "w-full")}
      >
        Sign in as a different user
      </button>
      <p className="text-xs text-muted-foreground">
        Signed in as the wrong person? Use <strong>Sign in as a different user</strong>.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LoginContent />
    </Suspense>
  );
}
