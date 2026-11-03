import { Redirect } from "expo-router";

/** Legacy isolate list. Certificates are on /lototo. */
export default function LegacyLototoActiveRedirect() {
  return <Redirect href="/lototo" />;
}
