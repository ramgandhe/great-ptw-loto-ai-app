import { Icon, ShieldCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <Icon icon={ShieldCheck} size="lg" className="text-primary" aria-label="Safety" />
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>
      <p className="text-muted-foreground">
        Platform infrastructure foundation. Organisation and operational modules follow in
        subsequent sprints.
      </p>
      <Button>Get started</Button>
    </main>
  );
}

