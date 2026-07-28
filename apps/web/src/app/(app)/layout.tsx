import { AppNavigation } from "@/components/app-navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppNavigation />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
