import type { PermitRecord } from "@/lib/permit/types";

type SupervisorDashboardWidgetProps = {
  active: PermitRecord[];
  suspended: PermitRecord[];
  approved: PermitRecord[];
};

export function SupervisorDashboardWidget({
  active,
  suspended,
  approved,
}: SupervisorDashboardWidgetProps) {
  const stats = [
    { label: "Active", count: active.length, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Suspended", count: suspended.length, tone: "text-amber-700 dark:text-amber-300" },
    { label: "Ready to activate", count: approved.length, tone: "text-blue-700 dark:text-blue-300" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stat.label}
          </p>
          <p className={`mt-1 text-2xl font-semibold ${stat.tone}`}>{stat.count}</p>
        </div>
      ))}
    </section>
  );
}
