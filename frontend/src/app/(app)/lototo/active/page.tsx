import { redirect } from "next/navigation";

/** Old bookmark. The isolation board lives at /lototo. */
export default function LototoActiveRedirect() {
  redirect("/lototo");
}
