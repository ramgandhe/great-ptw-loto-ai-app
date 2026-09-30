import { redirect } from "next/navigation";

/** Restoration is recorded on the permit after work is complete. */
export default function LototoRestorationRedirect() {
  redirect("/closure");
}
