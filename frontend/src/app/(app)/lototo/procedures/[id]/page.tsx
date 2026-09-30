"use client";

import { use } from "react";
import { LototoProcedureEditor } from "@/components/lototo/procedure-editor";

export default function LototoProcedurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LototoProcedureEditor procedureId={id} />;
}
