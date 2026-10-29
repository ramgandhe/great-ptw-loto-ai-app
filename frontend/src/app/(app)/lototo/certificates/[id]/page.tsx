"use client";

import { useParams } from "next/navigation";
import { CertificateJob } from "@/components/lototo/certificate-job";

export default function IsolationCertificatePage() {
  const params = useParams<{ id: string }>();
  return <CertificateJob id={params.id} />;
}
