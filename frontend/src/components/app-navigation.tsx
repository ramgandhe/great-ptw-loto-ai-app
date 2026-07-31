"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  ClipboardList,
  FileEdit,
  FileText,
  Hammer,
  LayoutDashboard,
  ListChecks,
  Lock,
  LockKeyhole,
  Settings,
  Shield,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/organisation", label: "Organisation", icon: Building2 },
  { href: "/permits", label: "Permits", icon: ClipboardList },
  { href: "/active-permits", label: "Active work", icon: Activity },
  { href: "/permits/drafts", label: "Drafts", icon: FileEdit },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/approvals/deferred", label: "Deferred", icon: ListChecks },
  { href: "/execution", label: "Execution", icon: Hammer },
  { href: "/lototo", label: "LOTOTO", icon: LockKeyhole },
  { href: "/simops", label: "SIMOPS", icon: TriangleAlert },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/closure", label: "Closure", icon: Lock },
  { href: "/ai", label: "AI assistant", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/workforce", label: "Workforce", icon: Users },
  { href: "/safety", label: "Safety", icon: Shield },
] as const;

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-card p-4"
    >
      <div className="mb-8 px-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          PTW Platform
        </p>
        <p className="text-sm font-semibold">Permit-to-Work</p>
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
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-foreground hover:bg-accent/60",
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
