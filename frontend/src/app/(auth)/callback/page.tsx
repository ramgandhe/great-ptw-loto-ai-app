"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeKeycloakLogin, consumeAuthRedirect } from "@/lib/auth/keycloak";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }

    const code = searchParams.get("code");
    const authError = searchParams.get("error_description") ?? searchParams.get("error");

    if (authError) {
      setError(authError);
      return;
    }

    if (!code) {
      setError("Missing authorization code.");
      return;
    }

    started.current = true;

    completeKeycloakLogin(code)
      .then(() => {
        router.replace(consumeAuthRedirect());
      })
      .catch((err: unknown) => {
        started.current = false;
        setError(err instanceof Error ? err.message : "Sign in failed.");
      });
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Sign in failed</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <a href="/login" className={cn(buttonVariants(), "w-full")}>
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">Signing in</h1>
      <p className="text-sm text-muted-foreground">Completing Keycloak authentication…</p>
    </div>
  );
}
