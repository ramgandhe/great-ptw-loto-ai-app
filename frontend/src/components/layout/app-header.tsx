"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
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
    <header className="sticky top-0 z-10 flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Active workspace
        </p>
        <TenantName className="truncate text-sm font-medium" />
      </div>
      <details className="group/profile relative shrink-0">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-background py-1 pl-1 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="size-8 shrink-0 rounded object-cover"
            />
          ) : (
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-sm font-semibold text-primary"
              aria-hidden="true"
            >
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="hidden max-w-40 text-left sm:block">
            <span className="block truncate text-sm font-semibold">{displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {roles.length > 0 ? formatRoleLabel(roles[0]) : "No roles assigned"}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {roles.length > 0 ? roles.map(formatRoleLabel).join(" · ") : "No roles assigned"}
            </p>
            <TenantName className="mt-1 truncate text-xs text-muted-foreground" />
          </div>
          <Link
            href="/settings"
            onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
            className="mt-1 flex h-10 items-center gap-2 rounded px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings aria-hidden="true" className="size-4" />
            Settings
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full justify-start gap-2 rounded px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={signOut}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </details>
    </header>
  );
}
