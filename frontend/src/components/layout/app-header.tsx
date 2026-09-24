"use client";

import { ThemeSettings } from "@/components/theme/theme-settings";
import { Button } from "@/components/ui/button";
import { TenantName } from "@/components/organisation/tenant-name";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { formatRoleLabel } from "@/lib/auth/rbac";
import { signOut } from "@/lib/auth/keycloak";

export function AppHeader() {
  const { profile, roles } = useAuthProfile();
  const displayName =
    profile?.displayName?.trim() ||
    (profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : (profile?.username ?? "Signed in"));

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
      <div className="flex min-w-0 items-center gap-3">
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover border border-border"
          />
        ) : (
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium"
            aria-hidden
          >
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            ({roles.length > 0 ? roles.map(formatRoleLabel).join(" · ") : "No roles assigned"})
          </p>
          <TenantName className="truncate text-xs text-muted-foreground" />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
        <ThemeSettings />
      </div>
    </header>
  );
}
