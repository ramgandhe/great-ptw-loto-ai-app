"use client";

import { useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080";
  const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "ptw-platform";
  const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "ptw-web";
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000/";

  const loginUrl = useMemo(() => {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid",
    });
    return `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth?${params.toString()}`;
  }, [clientId, keycloakUrl, realm, redirectUri]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Authenticate with Keycloak to access the platform.
        </p>
      </div>
      <a href={loginUrl} className={cn(buttonVariants(), "w-full")}>
        Continue with Keycloak
      </a>
    </div>
  );
}
