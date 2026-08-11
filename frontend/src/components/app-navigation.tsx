"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { getNavItemsForRoles } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function AppNavigation() {
  const pathname = usePathname();
  const { roles } = useAuthProfile();
  const navItems = getNavItemsForRoles(roles);

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground"
    >
      <div className="mb-8 px-2">
        <p className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
          PTW Platform
        </p>
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold">Permit-to-Work</p>
      </div>
      <ul className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon }) => {
          const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/12 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon icon={icon} size="sm" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
