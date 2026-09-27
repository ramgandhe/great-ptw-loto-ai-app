"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, Moon, Search, Settings, Sun } from "lucide-react";
import { TenantName } from "@/components/organisation/tenant-name";
import { useTheme } from "@/components/theme-provider";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { formatRoleLabel } from "@/lib/auth/rbac";
import { signOut } from "@/lib/auth/keycloak";

function Avatar({ url, name }: { url?: string | null; name: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-8 shrink-0 rounded-full border border-border object-cover" />
  ) : (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold"
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AppHeader({ onOpenNav, onOpenSearch }: { onOpenNav: () => void; onOpenSearch: () => void }) {
  const { profile, roles } = useAuthProfile();
  const { mode, setMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName =
    profile?.displayName?.trim() ||
    (profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : (profile?.username ?? "Signed in"));
  const roleLabel = roles.length > 0 ? roles.map(formatRoleLabel).join(", ") : "No roles assigned";

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        className="-ml-1 rounded-md p-1.5 text-muted-foreground hover:text-foreground lg:hidden"
        aria-label="Open navigation"
        aria-controls="app-navigation"
        onClick={onOpenNav}
      >
        <Menu className="size-5" />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-(--border-strong) sm:max-w-md"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search permits, pages and actions</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 text-xs sm:inline">Ctrl K</kbd>
      </button>

      <div ref={menuRef} className="relative ml-auto">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 hover:bg-muted sm:pr-3"
        >
          <Avatar url={profile?.avatarUrl} name={displayName} />
          <span className="hidden text-left sm:block">
            <span className="block max-w-40 truncate text-sm font-medium leading-tight">{displayName}</span>
            <span className="block max-w-40 truncate text-xs leading-tight text-muted-foreground">{roleLabel}</span>
          </span>
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-12 w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-(--shadow-lg)"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              <TenantName className="truncate text-xs text-muted-foreground" />
            </div>
            <div className="p-1.5">
              <Link
                role="menuitem"
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                <Settings className="size-4 text-muted-foreground" aria-hidden />
                Profile and appearance
              </Link>
              <button
                role="menuitem"
                type="button"
                onClick={() => setMode(mode === "dark" ? "light" : "dark")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                {mode === "dark" ? (
                  <Sun className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <Moon className="size-4 text-muted-foreground" aria-hidden />
                )}
                {mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                <LogOut className="size-4 text-muted-foreground" aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
