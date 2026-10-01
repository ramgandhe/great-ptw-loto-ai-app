import Link from "next/link";
import { SITE } from "@/lib/marketing/site";
import { cn } from "@/lib/utils";

const DOCS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/cookies", label: "Cookie policy" },
  { href: "/terms", label: "Terms and conditions" },
];

export type LegalSection = { id: string; title: string; body: React.ReactNode };

export function LegalPage({
  title,
  intro,
  current,
  sections,
}: {
  title: string;
  intro: React.ReactNode;
  current: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-20">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <nav aria-label="Legal documents" className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {DOCS.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              aria-current={doc.href === current ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                doc.href === current ? "bg-muted font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {doc.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="On this page" className="mt-8 hidden lg:block">
          <p className="px-3 text-xs font-semibold text-muted-foreground">On this page</p>
          <ol className="mt-2 space-y-1 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-md px-3 py-1 text-muted-foreground hover:text-foreground">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <article className="max-w-[68ch]">
        <h1 className="font-heading text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {SITE.legalLastUpdated}</p>
        <div className="mt-6 leading-7 text-muted-foreground">{intro}</div>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-border pt-8 mt-10">
            <h2 className="font-heading text-xl font-semibold">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-4 space-y-4 leading-7 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:text-foreground">
              {s.body}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
