"use client";

import Link from "next/link";
import { Building2, CreditCard, LogOut, Settings } from "lucide-react";
import { ThemeSettings } from "@/components/theme/theme-settings";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { Button } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { signOut } from "@/lib/auth/session";
import { BILLING_READ_ROLES, ORGANISATION_WRITE_ROLES, PLATFORM_ADMIN_ROLES } from "@/lib/auth/roles";
import { hasAnyRole } from "@/lib/auth/rbac";

/** Administration starts in one place; each link shows only to roles that can use it. */
const ADMIN_LINKS = [
  {
    href: "/organisation/setup",
    label: "Organisation setup",
    description: "Organisation, sites, permit configuration, people and notifications",
    icon: Building2,
    roles: ORGANISATION_WRITE_ROLES,
  },
  { href: "/billing", label: "Billing and subscription", description: "Plan, usage and invoices", icon: CreditCard, roles: BILLING_READ_ROLES },
  { href: "/platform/tenants", label: "Tenants", description: "Invite organisation owners and provision new tenants", icon: Building2, roles: PLATFORM_ADMIN_ROLES },
];

export default function SettingsPage() {
  const { roles } = useAuthProfile();
  const links = ADMIN_LINKS.filter((link) => hasAnyRole(roles, link.roles));

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <Settings className="size-6" aria-hidden />
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Your profile, how the app looks, and your account.
          </p>
        </div>
      </div>

      <ProfileSettingsForm />

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Theme, density, visual style and light/dark mode. Preferences are saved in this browser.
        </p>
        <div className="mt-4">
          <ThemeSettings variant="form" />
        </div>
      </section>


      {links.length ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Administration</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <item.icon className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <h3 className="font-semibold">{item.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          End the current Keycloak session on this device.
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={signOut}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </section>
    </main>
  );
}
