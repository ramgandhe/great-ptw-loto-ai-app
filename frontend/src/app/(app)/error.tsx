"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Unable to load this page</h1>
      <p className="max-w-xl text-sm text-muted-foreground">{error.message}</p>
      <Button type="button" onClick={reset}>
        Retry
      </Button>
    </main>
  );
}
