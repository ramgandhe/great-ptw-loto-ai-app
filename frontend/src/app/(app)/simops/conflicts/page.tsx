import { redirect } from "next/navigation";

/** Folded into the SIMOPS page as a view. */
export default function ActiveConflictsPage() {
  redirect("/simops?view=active");
}
