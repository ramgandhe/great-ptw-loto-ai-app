import { redirect } from "next/navigation";

/** Folded into the LOTOTO page as a view. */
export default function RestorationListPage() {
  redirect("/lototo?view=restoration");
}
