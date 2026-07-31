"use client";

import Link from "next/link";
import { Bell, Building2, CreditCard, LogOut, Settings } from "lucide-react";
import { ThemeSettings } from "@/components/theme/theme-settings";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/keycloak";

const links = [
  {
    href: "/organisation/profile",
    label: "Organisation profile",
    description: "Tenant details and registration",
    icon: Building2,
  },
  {
    href: "/organisation/notifications",
    label: "Notification preferences",
    description: "Channel and event notification settings",
    icon: Bell,
  },
  {
    href: "/billing",
    label: "Billing & subscription",
    description: "Plans, usage and invoice history",
    icon: CreditCard,
  },
];

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center gap-3">
        <Settings className="size-6" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Appearance, organisation configuration and account controls.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Theme, density, visual style and light/dark mode. Preferences are saved in this browser.
        </p>
        <div className="mt-4">
          <ThemeSettings variant="form" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Organisation</h2>
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
