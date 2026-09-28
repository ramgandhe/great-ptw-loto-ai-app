import { redirect } from "next/navigation";

/** Closed incidents are a view on the Incidents page. */
export default function IncidentArchivePage() {
  redirect("/incidents?view=closed");
}
