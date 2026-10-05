"use client";

import { useParams } from "next/navigation";
import { PermitJourney } from "@/components/permit/permit-journey";

export default function PermitJourneyPage() {
  return <PermitJourney id={useParams<{ id: string }>().id} />;
}
