import Link from "next/link";
import { CheckSquare, ClipboardList, Hammer, LayoutDashboard, Settings, Shield, Users } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/permits", label: "Permits", icon: ClipboardList },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/execution", label: "Execution", icon: Hammer },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/workforce", label: "Workforce", icon: Users },
  { href: "/safety", label: "Safety", icon: Shield },
];

export function AppNavigation() {
  return (
    <nav className="flex h-full w-56 flex-col border-r border-border bg-card p-4">
      <div className="mb-8 px-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          PTW Platform
        </p>
        <p className="text-sm font-semibold">SP-01.01</p>
      </div>
      <ul className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
