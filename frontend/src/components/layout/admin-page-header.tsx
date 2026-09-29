"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

const HUBS: Record<string, { href: string; label: string }> = {
  organisation: { href: "/organisation", label: "Organisation" },
  workforce: { href: "/workforce", label: "Workforce" },
  platform: { href: "/settings", label: "Settings" },
};

/** True when an admin page is rendered as a step inside the organisation setup wizard. */
export const AdminEmbedContext = createContext(false);

/** Shared input styling for admin forms. */
export const FIELD_CLASS =
  "h-10 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Page frame for admin pages; a plain block when embedded in the setup wizard, which owns the page. */
export function AdminPage({ children }: { children: React.ReactNode }) {
  return useContext(AdminEmbedContext) ? (
    <div className="flex flex-col gap-5">{children}</div>
  ) : (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-8 sm:px-8">{children}</main>
  );
}

/**
 * Admin page title: the same sticky header as the Safety pages, with the way back to its hub.
 * `children` (search, view toggles) stick with it.
 */
export function AdminPageHeader({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const hub = usePathname().split("/")[1] ?? "";
  // Inside the wizard the step supplies its own title and help; keep only the action and filters.
  if (useContext(AdminEmbedContext)) {
    return action || children ? (
      <div className="flex flex-col gap-3">
        {action ? <div className="flex justify-end">{action}</div> : null}
        {children}
      </div>
    ) : null;
  }
  return (
    <PageHeader
      back={HUBS[hub]}
      title={title}
      description={description}
      actions={action}
    >
      {children}
    </PageHeader>
  );
}
