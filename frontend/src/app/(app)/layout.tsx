import { AppLayoutShell } from "@/components/layout/app-layout-shell";
import { AuthGate } from "@/components/auth/auth-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppLayoutShell>{children}</AppLayoutShell>
    </AuthGate>
  );
}
