"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import {
  canAccessPath,
  formatRoleLabel,
  getDefaultHomePath,
  getRequiredRolesForPath,
} from "@/lib/auth/rbac";

export function RoleGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { roles, isLoading, error } = useAuthProfile();

  useEffect(() => {
    if (isLoading || error) {
      return;
    }

    if (pathname === "/unauthorized") {
      return;
    }

    if (!canAccessPath(pathname, roles)) {
      if (pathname === "/") {
        router.replace(getDefaultHomePath(roles));
        return;
      }
      router.replace(`/unauthorized?from=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, roles, isLoading, error, router]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading your access permissions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Sign in again
        </Link>
      </div>
    );
  }

  if (pathname !== "/unauthorized" && !canAccessPath(pathname, roles)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return children;
}

export function UnauthorizedMessage({ from }: { from?: string | null }) {
  const { roles } = useAuthProfile();
  const required = from ? getRequiredRolesForPath(from) : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        Your account does not have permission to open this screen. Access is determined by the
        roles assigned to your login.
      </p>
      {roles.length > 0 ? (
        <p className="text-sm">
          <span className="font-medium">Your roles:</span>{" "}
          {roles.map(formatRoleLabel).join(", ")}
        </p>
      ) : null}
      {required && required.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Required roles: {required.map(formatRoleLabel).join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href={getDefaultHomePath(roles)} className={buttonVariants()}>
          Go to your home
        </Link>
        <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
          Settings
        </Link>
      </div>
    </div>
  );
}
