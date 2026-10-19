"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

export function AppNavigation({
  open,
  collapsed,
  onClose,
  onToggleCollapsed,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
}) {
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
          "fixed inset-y-0 left-0 z-50 flex w-68 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          "lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:translate-x-0 lg:transition-[width] print:hidden",
          collapsed ? "lg:w-16 lg:p-2" : "lg:w-64",
          "ptw-navigation",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("mb-7 flex items-center justify-between px-2", collapsed && "lg:justify-center lg:px-0")}>
          <Link href="/dashboard" onClick={onClose} aria-label="PermitWiseAI home" className="rounded-md focus-visible:outline-2 focus-visible:outline-ring">
            <BrandMark className={cn("text-base text-sidebar-foreground [&_span>span]:text-sidebar-primary", collapsed && "lg:[&>span:last-child]:sr-only")} />
          </Link>
          <button
            type="button"
            className="hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-controls="app-navigation"
            aria-expanded={!collapsed}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
          </button>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className={cn("mb-6 border-y border-sidebar-border px-3 py-2.5", collapsed && "lg:hidden")}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-primary">Operations workspace</p>
          <p className="mt-1 text-xs text-sidebar-foreground/65">Permits · isolation · safety</p>
        </div>

        {NAV_GROUPS.map((group) => {
          const items = navItems.filter((item) => item.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-5">
              <p className={cn("mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45", collapsed && "lg:sr-only")}>
                {group === "Work" ? "Workspace" : group === "Safety" ? "Risk & safety" : group === "Insights" ? "Performance" : group}
              </p>
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
                        title={collapsed ? label : undefined}
                        className={cn(
                          "press relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm",
                          collapsed && "lg:justify-center lg:gap-0 lg:px-0",
                          isActive
                            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary [&_svg]:text-sidebar-primary"
                            : "text-sidebar-foreground/72 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon icon={icon} size="sm" />
                        <span className={cn("flex-1", collapsed && "lg:sr-only")}>{label}</span>
                        {count > 0 ? (
                          <span
                            className={cn(
                              "min-w-5 rounded-full px-1.5 text-center text-xs font-bold leading-5 tabular-nums",
                              collapsed && "lg:absolute lg:-right-1 lg:-top-1 lg:min-w-4 lg:px-1 lg:text-[10px] lg:leading-4",
                              isActive ? "bg-sidebar-primary/15 text-sidebar-primary" : "bg-sidebar-accent text-sidebar-foreground/75",
                            )}
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
        <div className="mt-auto border-t border-sidebar-border pt-4">
          <p className={cn("px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40", collapsed && "lg:sr-only")}>Safety is a shared responsibility</p>
        </div>
      </nav>
    </>
  );
}
