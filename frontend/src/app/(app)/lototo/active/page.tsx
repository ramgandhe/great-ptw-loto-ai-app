import { redirect } from "next/navigation";

/** Folded into the LOTOTO page as a view. */
export default function ActiveLototoPage() {
  redirect("/lototo?view=active");
}
