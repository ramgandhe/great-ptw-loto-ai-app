import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `Cookie policy | ${SITE.product}`,
  description: `The cookies and browser storage ${SITE.product} uses, and why.`,
};

const STORAGE: [string, string, string, string][] = [
  ["ptw_access_token", "Local storage", "Keeps you signed in to the app", "Until you sign out or it expires"],
  ["ptw_refresh_token", "Local storage", "Renews your session without asking you to sign in again", "Until you sign out or it expires"],
  ["ptw_pkce_verifier", "Session storage", "Protects the sign-in handshake against interception", "Removed once sign-in completes"],
  ["ptw_auth_redirect", "Session storage", "Returns you to the page you were on after sign-in", "Removed once used"],
  ["ptw-theme-preferences-v2", "Local storage", "Remembers your theme, density and light or dark mode", "Until you clear it"],
  ["AUTH_SESSION_ID, KC_RESTART", "Cookie, sign-in service", "Tracks a sign-in attempt in progress", "End of browser session"],
  ["KEYCLOAK_IDENTITY, KEYCLOAK_SESSION", "Cookie, sign-in service", "Keeps your single sign-on session", "End of the sign-on session"],
];

const sections: LegalSection[] = [
  {
    id: "what",
    title: "What cookies and browser storage are",
    body: (
      <p>
        Cookies are small files a website saves in your browser. Local and session storage do a
        similar job inside the browser without being sent to the server on every request. We use
        both only where the service cannot work without them.
      </p>
    ),
  },
  {
    id: "use",
    title: "What we use",
    body: (
      <>
        <p>
          We use <strong>strictly necessary</strong> storage only. There are no advertising,
          analytics or third-party tracking cookies on this website or in the app.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground">
                <th scope="col" className="py-2 pr-4 font-semibold">Name</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Type</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Purpose</th>
                <th scope="col" className="py-2 font-semibold">Lasts</th>
              </tr>
            </thead>
            <tbody>
              {STORAGE.map(([name, type, purpose, lasts]) => (
                <tr key={name} className="border-b border-border align-top last:border-0">
                  <td className="py-2.5 pr-4 font-mono text-xs text-foreground">{name}</td>
                  <td className="py-2.5 pr-4">{type}</td>
                  <td className="py-2.5 pr-4">{purpose}</td>
                  <td className="py-2.5">{lasts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "consent",
    title: "Consent",
    body: (
      <p>
        Strictly necessary storage is needed to provide the service you asked for, so we do not
        ask for separate consent for it. If we ever add analytics or other optional cookies, we
        will ask for your consent first and update this page.
      </p>
    ),
  },
  {
    id: "manage",
    title: "Managing cookies",
    body: (
      <p>
        You can clear or block cookies and site data in your browser settings. If you do, you will
        be signed out and will need to sign in again. Blocking them entirely will stop sign-in
        from working.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about this policy: <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>.
        How we handle personal data is described in our <Link href="/privacy">privacy policy</Link>.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      current="/cookies"
      intro={<p>This policy lists every cookie and piece of browser storage {SITE.product} uses.</p>}
      sections={sections}
    />
  );
}
