"use client";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeSettings } from "@/components/theme/theme-settings";
import { Button } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { formatRoleLabel } from "@/lib/auth/rbac";
import { signOut } from "@/lib/auth/keycloak";

export function AppHeader() {
  const { profile, roles } = useAuthProfile();
  const displayName =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : (profile?.username ?? "Signed in");

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {roles.length > 0 ? roles.map(formatRoleLabel).join(" · ") : "No roles assigned"}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <Button type="button" variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
        <ThemeSettings />
      </div>
    </header>
  );
}
