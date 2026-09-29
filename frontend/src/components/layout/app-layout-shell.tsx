import { AppHeader } from "@/components/layout/app-header";
import { AppNavigation } from "@/components/app-navigation";
import { ErrorBoundary } from "@/components/error-boundary";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <AppNavigation />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader />
        <div className="app-page-content flex flex-1 flex-col">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
