"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function OAuthCodeRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname === "/callback" || pathname === "/login") {
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      return;
    }

    router.replace(`/callback?${searchParams.toString()}`);
  }, [pathname, router, searchParams]);

  return null;
}
