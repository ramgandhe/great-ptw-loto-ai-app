import { AppLayoutShell } from "@/components/layout/app-layout-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { RoleGate } from "@/components/auth/role-gate";
import { AuthProfileProvider } from "@/lib/auth/auth-profile-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AuthProfileProvider>
        <RoleGate>
          <AppLayoutShell>{children}</AppLayoutShell>
        </RoleGate>
      </AuthProfileProvider>
    </AuthGate>
  );
}
