import Link from "next/link";
import { Building2 } from "lucide-react";

const sections = [
  { href: "/organisation/profile", label: "Organisation profile", description: "Tenant details and registration" },
  { href: "/organisation/plants", label: "Plants", description: "Top-level operational sites" },
  { href: "/organisation/departments", label: "Departments", description: "Functional departments" },
  { href: "/organisation/locations", label: "Locations", description: "Work locations within plants" },
  { href: "/organisation/workstations", label: "Workstations", description: "Workstation hierarchy" },
  { href: "/organisation/machinery", label: "Machinery", description: "Machinery and equipment" },
  { href: "/organisation/workflows", label: "Approval workflows", description: "Multi-stage approval routing" },
  { href: "/organisation/templates", label: "Permit templates", description: "Published permit templates" },
  { href: "/organisation/checklists", label: "Safety checklists", description: "Reusable safety checklists" },
  { href: "/organisation/ppe", label: "PPE configuration", description: "Organisation PPE requirements" },
  { href: "/organisation/notifications", label: "Notification preferences", description: "Channel and event preferences" },
];

export default function OrganisationDashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Building2 className="size-6" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">Organisation management</h1>
          <p className="text-sm text-muted-foreground">
            Configure tenant hierarchy and operational settings (SP-01.02).
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
          >
            <h2 className="font-semibold">{section.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
