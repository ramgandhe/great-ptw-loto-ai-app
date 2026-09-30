"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LototoProcedureEditor } from "@/components/lototo/procedure-editor";

function NewProcedure() {
  const params = useSearchParams();
  return <LototoProcedureEditor initialMachineryId={params.get("machineryId") ?? undefined} />;
}

export default function NewLototoProcedurePage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading…</main>}>
      <NewProcedure />
    </Suspense>
  );
}
