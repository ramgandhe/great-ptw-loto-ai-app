"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Icon } from "@/components/icons";
import { BrandMark } from "@/components/marketing/site-header";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { getNavItemsForRoles, NAV_GROUPS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useWorkQueue } from "@/lib/work-queue-context";

/** Longest matching href wins, so /permits/drafts doesn't also light up /permits. */
function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function AppNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { roles } = useAuthProfile();
  const { counts } = useWorkQueue();
  const navItems = getNavItemsForRoles(roles);
  const current = activeHref(
    pathname,
    navItems.map((item) => item.href),
  );

  return (
    <>
      {/* Always mounted so the backdrop fades out with the drawer instead of vanishing. */}
      <button
        type="button"
        aria-label="Close navigation"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        className={cn(
          "fixed inset-0 z-40 bg-(--bg-overlay) transition-opacity duration-200 ease-out lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <nav
        id="app-navigation"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          "lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-60 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <Link href="/dashboard" onClick={onClose} className="rounded-md focus-visible:outline-2 focus-visible:outline-ring">
            <BrandMark className="text-base" />
          </Link>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        {NAV_GROUPS.map((group) => {
          const items = navItems.filter((item) => item.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-5">
              {group !== "Work" ? (
                <p className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{group}</p>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {items.map(({ href, label, icon }) => {
                  const isActive = href === current;
                  const count = counts[href] ?? 0;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/12 font-medium text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <Icon icon={icon} size="sm" />
                        <span className="flex-1">{label}</span>
                        {count > 0 ? (
                          <span
                            className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-semibold leading-5 text-primary-foreground"
                            aria-label={`${count} need${count === 1 ? "s" : ""} your action`}
                          >
                            {count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </>
  );
}
