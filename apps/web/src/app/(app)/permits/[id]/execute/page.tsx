"use client";

import { useParams } from "next/navigation";
import { ExecutionWorkspace } from "@/components/execution/execution-workspace";

export default function ExecutePermitPage() {
  const params = useParams<{ id: string }>();
  return (
    <main className="flex flex-1 flex-col p-4 sm:p-6 lg:p-8">
      <ExecutionWorkspace permitId={params.id} />
    </main>
  );
}
