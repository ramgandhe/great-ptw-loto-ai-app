import { redirect } from "next/navigation";

/** Legacy execution screen. Use the isolation certificate job instead. */
export default function LegacyLototoExecuteRedirect() {
  redirect("/lototo");
}
