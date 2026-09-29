"use client";

import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/motion";

export type HubLink = { href: string; label: string; description: string; icon: LucideIcon };
export type HubGroup = { title: string; description: string; links: HubLink[] };

/** Settings hubs: links grouped by job, in the order an admin sets things up. */
export function HubPage({
  title,
  intro,
  groups,
  children,
}: {
  title: string;
  intro: React.ReactNode;
  groups: HubGroup[];
  /** Shown above the groups, e.g. a setup progress card. */
  children?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 pb-8 sm:px-8">
      <PageHeader title={title} description={intro} />
      {children}
      <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-8">
        {groups.map((group) => (
          <motion.section key={group.title} variants={staggerItem} aria-labelledby={`hub-${group.title}`}>
            <h2 id={`hub-${group.title}`} className="font-semibold">
              {group.title}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{group.description}</p>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-(--border-strong)"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary">
                      <link.icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{link.label}</span>
                      <span className="block truncate text-sm text-muted-foreground">{link.description}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.section>
        ))}
      </motion.div>
    </main>
  );
}
