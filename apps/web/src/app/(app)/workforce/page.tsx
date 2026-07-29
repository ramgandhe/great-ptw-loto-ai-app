import Link from "next/link";
import { Users } from "lucide-react";

const sections = [
  { href: "/workforce/employees", label: "Employees", description: "Register and manage employees" },
  { href: "/workforce/contractors", label: "Contractors", description: "Contractor registration" },
  { href: "/workforce/agencies", label: "Agencies", description: "Agency management" },
  { href: "/workforce/directory", label: "Workforce directory", description: "Combined workforce view" },
  { href: "/workforce/roles", label: "User roles", description: "Assign organisational roles" },
  { href: "/workforce/competencies", label: "Competencies", description: "Competency records" },
  { href: "/workforce/certifications", label: "Certifications", description: "Certification tracking" },
];

export default function WorkforceDashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Users className="size-6" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">Workforce management</h1>
          <p className="text-sm text-muted-foreground">Personnel, roles and competencies (SP-01.03).</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-lg border border-border bg-card p-4 hover:bg-accent/40">
            <h2 className="font-semibold">{s.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
