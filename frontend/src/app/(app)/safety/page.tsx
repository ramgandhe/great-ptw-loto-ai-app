import Link from "next/link";
import { Shield } from "lucide-react";

const sections = [
  { href: "/permits", label: "Permits", description: "Create, edit and track permit-to-work requests" },
  { href: "/approvals", label: "Approvals", description: "Review and approve pending permit workflows" },
  { href: "/execution", label: "Execution", description: "Active permit execution, progress and evidence" },
  { href: "/closure", label: "Closure", description: "Close permits and browse the archive" },
];

export default function SafetyPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Shield className="size-6" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">Safety</h1>
          <p className="text-sm text-muted-foreground">
            Permit-to-work lifecycle from creation through closure.
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
