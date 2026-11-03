import { redirect } from "next/navigation";

/** Legacy plan detail. Isolations live on certificates. */
export default function LegacyLototoPlanRedirect() {
  redirect("/lototo");
}
