import { redirect } from "next/navigation";

/** Folded into the SIMOPS page as a view. */
export default function SimopsHistoryPage() {
  redirect("/simops?view=history");
}
