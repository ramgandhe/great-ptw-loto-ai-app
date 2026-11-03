import { redirect } from "next/navigation";

/** Legacy restoration list. Use the isolation board instead. */
export default function LegacyLototoRestorationRedirect() {
  redirect("/lototo");
}
