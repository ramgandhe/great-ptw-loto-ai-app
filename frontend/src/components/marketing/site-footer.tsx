import Link from "next/link";
import { SITE } from "@/lib/marketing/site";
import { BrandMark } from "./site-header";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/#flow", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/#why", label: "Why switch" },
      { href: "/#security", label: "Security" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/register", label: "Request access" },
      { href: "/login", label: "Sign in" },
      { href: `mailto:${SITE.contactEmail}`, label: "Contact us" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/cookies", label: "Cookie policy" },
      { href: "/terms", label: "Terms and conditions" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <BrandMark />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Permit-to-work, lockout/tagout and incident control for industrial sites, in one
            auditable record.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <h2 className="text-sm font-semibold">{col.heading}</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © 2026 {SITE.company}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
