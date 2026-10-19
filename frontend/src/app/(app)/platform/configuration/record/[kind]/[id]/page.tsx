"use client";

import { useParams } from "next/navigation";
import { RecordEditor } from "./record-editor";

export default function ConfigurationRecordPage() {
  const params = useParams<{ kind: string; id: string }>();
  return <RecordEditor kind={params.kind} recordId={params.id} />;
}
