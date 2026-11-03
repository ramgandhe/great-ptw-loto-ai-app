import { redirect } from "next/navigation";

/** Legacy restoration screen. Use the isolation certificate job instead. */
export default function LegacyLototoRestorationDetailRedirect() {
  redirect("/lototo");
}
