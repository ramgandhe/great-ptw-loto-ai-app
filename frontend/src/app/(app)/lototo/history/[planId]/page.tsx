import { redirect } from "next/navigation";

/** Legacy history screen. Use the isolation certificate job instead. */
export default function LegacyLototoHistoryRedirect() {
  redirect("/lototo");
}
