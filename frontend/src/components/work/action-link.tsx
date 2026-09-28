import Link from "next/link";
import { cn } from "@/lib/utils";
import { WORK_ACTIONS, type ActionKind, type WorkItem } from "@/lib/work-queue";

/**
 * A row's next step. Colour says what kind of job it is (decide, fix, do, admin); urgent jobs
 * are solid and breathe a halo, the rest are tinted so the urgent ones stand out.
 */
export function ActionButtonLink({
  href,
  kind,
  urgent = false,
  className,
  children,
}: {
  href: string;
  kind: ActionKind;
  urgent?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-kind={kind}
      style={{ "--act": `var(--act-${kind})`, "--chip": `var(--act-${kind})` } as React.CSSProperties}
      className={cn(
        "press relative z-10 inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        urgent ? "act-urgent bg-(--act) text-(--st-ink) hover:brightness-110" : "chip hover:brightness-95 dark:hover:brightness-125",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function ActionLink({ item, className }: { item: WorkItem; className?: string }) {
  return (
    <ActionButtonLink href={item.href} kind={WORK_ACTIONS[item.action].kind} urgent={item.urgent} className={className}>
      {item.label}
    </ActionButtonLink>
  );
}
