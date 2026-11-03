import { Redirect } from "expo-router";

/** Legacy new plan. Procedures and certificates are created on web / from the isolations board. */
export default function LegacyLototoNewRedirect() {
  return <Redirect href="/lototo" />;
}
