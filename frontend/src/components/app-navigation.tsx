"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Icon } from "@/components/icons";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { getNavItemsForRoles } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const NAV_GROUPS: { label: string; items: string[] }[] = [
  { label: "Overview", items: ["Dashboard"] },
  {
    label: "Permit workflow",
    items: ["Permits", "Active work", "Drafts", "Assigned drafts", "Approvals", "Deferred", "Execution", "LOTOTO", "Closure"],
  },
  { label: "Safety & reporting", items: ["SIMOPS", "Incidents", "Analytics", "Reports"] },
  { label: "Organisation", items: ["Organisation", "Workforce"] },
  { label: "Administration", items: ["Tenants", "Billing", "Settings"] },
];

export function AppNavigation() {
  const pathname = usePathname();
  const { roles } = useAuthProfile();
  const navItems = getNavItemsForRoles(roles);
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    links: navItems.filter((item) => group.items.includes(item.label)),
  })).filter((group) => group.links.length > 0);

  function renderGroups(mobile = false) {
    return navGroups.map((group) => (
      <section key={group.label} className="min-w-0">
        <h2
          className={cn(
            "mb-1 px-3 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
            mobile ? "mt-4 first:mt-0" : "",
          )}
        >
          {group.label}
        </h2>
        <ul className="flex flex-col gap-0.5">
          {group.links.map(({ href, label, icon }) => {
            const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

            return (
              <li key={label}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                  className={cn(
                    "flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "bg-primary/10 font-semibold text-primary"
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
      </section>
    ));
  }

  return (
    <nav
      aria-label="Main navigation"
      className="relative z-20 flex w-full shrink-0 flex-col border-b border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:w-60 md:border-b-0 md:border-r md:p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3 px-1 md:mb-8 md:justify-start md:px-2">
        <div
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-xs font-semibold text-primary-foreground"
        >
          PTW
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            PTW Platform
          </p>
          <p className="truncate font-heading text-sm font-semibold">
            Permit-to-Work
          </p>
        </div>
        <details className="group md:hidden">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <Menu aria-hidden="true" className="size-4" />
            Menu
          </summary>
          <div className="absolute left-0 right-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-card p-4 text-foreground shadow-md">
            <div className="grid gap-4 sm:grid-cols-2">{renderGroups(true)}</div>
          </div>
        </details>
      </div>
      <div className="hidden min-h-0 flex-1 flex-col gap-5 overflow-y-auto md:flex">
        {renderGroups()}
      </div>
    </nav>
  );
}
