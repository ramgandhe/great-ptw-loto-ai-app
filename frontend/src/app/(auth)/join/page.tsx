"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { startKeycloakLogin } from "@/lib/auth/keycloak";
import { getAccessToken, isAuthenticated } from "@/lib/auth/token-storage";
import { platformTenantsApi, type PublicTenantInvite } from "@/lib/platform/api";

function sessionMatchesInvite(ownerEmail: string): boolean {
  const token = getAccessToken();
  if (!token) {
    return false;
  }
  const payload = token.split(".")[1];
  if (!payload) {
    return false;
  }
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      email?: string;
      preferred_username?: string;
      realm_access?: { roles?: string[] };
    };
    if (json.realm_access?.roles?.includes("platform-admin")) {
      return false;
    }
    const signedIn = (json.email ?? json.preferred_username)?.trim().toLowerCase();
    return Boolean(signedIn && signedIn === ownerEmail.toLowerCase());
  } catch {
    return false;
  }
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [invite, setInvite] = useState<PublicTenantInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setError("This join link is missing an invite token.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const nextInvite = await platformTenantsApi.getInvite(token);
        if (cancelled) {
          return;
        }
        setInvite(nextInvite);
        if (isAuthenticated() && sessionMatchesInvite(nextInvite.ownerEmail)) {
          try {
            await platformTenantsApi.acceptInvite(token);
            if (!cancelled) {
              router.replace("/");
            }
            return;
          } catch (err) {
            if (!cancelled) {
              setError(
                err instanceof ApiError
                  ? err.message
                  : "Sign in with the invited owner email to join this organisation.",
              );
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Invite not found");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading invite…</p>;
  }

  if (!invite) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Invite not valid</h1>
        <p className="text-sm text-destructive">{error ?? "Invite not found"}</p>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Join {invite.organisationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in as <span className="font-medium text-foreground">{invite.ownerEmail}</span> with the
          temporary password from your platform administrator. You will be asked to set a new
          password.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={cn(buttonVariants(), "w-full")}
        onClick={() =>
          startKeycloakLogin(`/join?token=${encodeURIComponent(token)}`, {
            forceLogin: true,
            loginHint: invite.ownerEmail,
          })
        }
      >
        Continue to sign in
      </button>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <JoinContent />
    </Suspense>
  );
}
