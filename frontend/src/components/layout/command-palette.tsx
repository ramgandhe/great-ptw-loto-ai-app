"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, CornerDownLeft, FilePlus2, ListChecks, Search, Siren } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { INCIDENT_REPORT_ROLES, ORGANISATION_WRITE_ROLES, PERMIT_CREATE_ROLES } from "@/lib/auth/roles";
import { getNavItemsForRoles } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useWorkQueue } from "@/lib/work-queue-context";

type Result = {
  key: string;
  section: "Permits" | "Actions" | "Go to";
  label: string;
  hint?: string;
  status?: string;
  href: string;
  icon: LucideIcon;
};

const MAX_PERMITS = 8;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { roles } = useAuthProfile();
  const { permits } = useWorkQueue();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (text: string) => !q || text.toLowerCase().includes(q);

    const permitResults: Result[] = q
      ? permits
          .filter((p) => matches(`${p.reference ?? ""} ${p.title}`))
          .slice(0, MAX_PERMITS)
          .map((p) => ({
            key: `permit:${p.id}`,
            section: "Permits",
            label: p.title,
            hint: p.reference ?? undefined,
            status: p.status,
            href: `/permits/${p.id}`,
            icon: ClipboardList,
          }))
      : [];

    const actions: Result[] = [];
    if (hasAnyRole(roles, PERMIT_CREATE_ROLES)) {
      actions.push({ key: "act:new-permit", section: "Actions", label: "Create a permit", href: "/permits/new", icon: FilePlus2 });
    }
    if (hasAnyRole(roles, INCIDENT_REPORT_ROLES)) {
      actions.push({ key: "act:incident", section: "Actions", label: "Report an incident or near miss", href: "/incidents/new", icon: Siren });
    }
    if (hasAnyRole(roles, ORGANISATION_WRITE_ROLES)) {
      actions.push({ key: "act:org-setup", section: "Actions", label: "Set up the organisation", href: "/organisation/setup", icon: ListChecks });
    }

    const pages: Result[] = getNavItemsForRoles(roles).map((item) => ({
      key: `nav:${item.href}`,
      section: "Go to",
      label: item.label,
      href: item.href,
      icon: item.icon,
    }));

    return [...permitResults, ...actions.filter((a) => matches(a.label)), ...pages.filter((p) => matches(p.label))];
  }, [query, permits, roles]);

  if (!open) return null;

  const safeCursor = Math.min(cursor, Math.max(results.length - 1, 0));

  function go(result: Result | undefined) {
    if (!result) return;
    setQuery("");
    setCursor(0);
    onClose();
    router.push(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[safeCursor]);
    } else if (event.key === "Escape") {
      onClose();
    }
  }

  let lastSection: Result["section"] | null = null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-(--bg-overlay) px-4 pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and jump"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-(--shadow-lg)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Permit reference or title, a page, or an action"
            aria-label="Search"
            aria-controls="command-results"
            aria-activedescendant={results[safeCursor] ? `cmd-${safeCursor}` : undefined}
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 text-xs text-muted-foreground">Esc</kbd>
        </div>
        <ul id="command-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No permit, page or action matches &ldquo;{query}&rdquo;.
            </li>
          ) : (
            results.map((result, index) => {
              const header = result.section !== lastSection ? result.section : null;
              lastSection = result.section;
              return (
                <li key={result.key} role="presentation">
                  {header ? <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">{header}</p> : null}
                  <div
                    id={`cmd-${index}`}
                    role="option"
                    aria-selected={index === safeCursor}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(result)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                      index === safeCursor ? "bg-accent text-accent-foreground" : "",
                    )}
                  >
                    <result.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{result.label}</span>
                    {result.hint ? <span className="font-mono text-xs text-muted-foreground">{result.hint}</span> : null}
                    {result.status ? <PermitStatusBadge status={result.status} /> : null}
                    {index === safeCursor ? <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden /> : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
