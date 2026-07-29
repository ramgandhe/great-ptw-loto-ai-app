"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CheckSquare, ClipboardList, FileEdit, LayoutDashboard, ListChecks } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/permits", label: "Permits", icon: ClipboardList },
  { href: "/active-permits", label: "Active work", icon: Activity },
  { href: "/permits/drafts", label: "Drafts", icon: FileEdit },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/approvals/deferred", label: "Deferred", icon: ListChecks },
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 flex-col border-r border-border bg-card p-4">
      <div className="mb-8 px-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          PTW Platform
        </p>
        <p className="text-sm font-semibold">Permit-to-Work Core</p>
      </div>
      <ul className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent ${
                  isActive ? "bg-accent font-medium text-foreground" : "text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
