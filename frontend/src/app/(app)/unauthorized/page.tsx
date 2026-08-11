"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UnauthorizedMessage } from "@/components/auth/role-gate";

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  return <UnauthorizedMessage from={from} />;
}

export default function UnauthorizedPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-muted-foreground">Loading access details…</div>
      }
    >
      <UnauthorizedContent />
    </Suspense>
  );
}
