"use client";

import { ThemeSettings } from "@/components/theme/theme-settings";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/keycloak";
import { isAuthenticated } from "@/lib/auth/token-storage";

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
      <p className="text-sm text-muted-foreground">Platform Foundation</p>
      <div className="ml-auto flex items-center gap-2">
        {isAuthenticated() ? (
          <Button type="button" variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        ) : null}
        <ThemeSettings />
      </div>
    </header>
  );
}
