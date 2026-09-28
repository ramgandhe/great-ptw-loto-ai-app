import { redirect } from "next/navigation";

/** Incidents are reported in place on the Incidents page. */
export default function NewIncidentPage() {
  redirect("/incidents?new=1");
}
