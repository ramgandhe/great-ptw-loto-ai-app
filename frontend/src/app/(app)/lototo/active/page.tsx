import { redirect } from "next/navigation";

/** Isolation tracking lives on the permit. This route kept for old bookmarks. */
export default function LototoActiveRedirect() {
  redirect("/lototo");
}
