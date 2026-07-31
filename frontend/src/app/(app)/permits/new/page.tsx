"use client";

import dynamic from "next/dynamic";

const PermitWizard = dynamic(
  () => import("@/components/permit/permit-wizard").then((module) => module.PermitWizard),
  {
    loading: () => (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading permit wizard…</p>
      </main>
    ),
    ssr: false,
  },
);

export default function NewPermitPage() {
  return <PermitWizard mode="create" />;
}
