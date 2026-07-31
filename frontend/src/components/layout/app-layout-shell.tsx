import { AppHeader } from "@/components/layout/app-header";
import { AppNavigation } from "@/components/app-navigation";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppNavigation />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
