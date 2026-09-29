"use client";

import { useSyncExternalStore } from "react";
import { APP_NAV_ITEMS } from "@/lib/navigation";

/**
 * The in-app pages visited this tab, oldest first, each with its query (filters, views).
 * Back links use it to return where the user actually came from instead of a fixed parent.
 * Kept in sessionStorage so a reload keeps the trail; a new tab starts empty.
 */
const KEY = "ptw_nav_trail";
const MAX = 30;
let trail: string[] = [];
const listeners = new Set<() => void>();

function load() {
  try {
    trail = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    trail = [];
  }
}
if (typeof window !== "undefined") load();

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    // Private mode or storage full: the trail still works for this page's life.
  }
  listeners.forEach((l) => l());
}

const pathOf = (url: string) => url.split("?")[0];

/** Called on every route change with the current path and query. */
export function recordVisit(url: string) {
  const last = trail.at(-1);
  if (last && pathOf(last) === pathOf(url)) {
    // Same page, new filters: remember the latest view of it.
    if (last !== url) {
      trail = [...trail.slice(0, -1), url];
      save();
    }
    return;
  }
  const previous = trail.at(-2);
  // Going back to the page before (browser back or a back link): drop the page we left.
  trail = previous && pathOf(previous) === pathOf(url) ? [...trail.slice(0, -2), url] : [...trail, url].slice(-MAX);
  save();
}

/**
 * The page the user came from, if it was inside the app. Only when the trail ends on `pathname`:
 * pages outside the app shell (sign-in) are not recorded, so an old trail must not apply to them.
 */
export function usePreviousPage(pathname: string): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (trail.length > 1 && pathOf(trail.at(-1)!) === pathname ? trail.at(-2)! : null),
    () => null,
  );
}

/** Detail pages by pattern; list pages come from the menu. First match wins. */
const PATTERNS: [RegExp, string][] = [
  [/^\/settings$/, "Settings"],
  [/^\/permits\/new$/, "New permit"],
  [/^\/permits\/[^/]+\/(edit|journey|execute|preview|multi-day)$/, "Permit"],
  [/^\/permits\/[^/]+$/, "Permit"],
  [/^\/approvals\/[^/]+/, "Approval"],
  [/^\/execution\/[^/]+/, "Work in progress"],
  [/^\/closure\/[^/]+/, "Closure"],
  [/^\/incidents\/[^/]+$/, "Incident"],
  [/^\/lototo\/plans\/[^/]+$/, "LOTOTO plan"],
  [/^\/lototo\/(execute|history|restoration)\/[^/]+$/, "LOTOTO"],
  [/^\/simops\/(conflicts|history)\/[^/]+$/, "Clash"],
  [/^\/notifications\/[^/]+$/, "Message"],
  [/^\/organisation\/templates\/[^/]+$/, "Permit template"],
  [/^\/organisation\/setup$/, "Organisation setup"],
];
const PAGE_LABELS: Record<string, string> = { ppe: "PPE", roles: "Users and roles", "gas-testing": "Gas testing" };
const SECTION_LABELS: Record<string, string> = {
  organisation: "Organisation",
  workforce: "Workforce",
};

/** A short name for an in-app URL, for "← Back to …" links. */
export function pageLabel(url: string): string {
  const path = pathOf(url);
  const nav = APP_NAV_ITEMS.find((item) => item.href === path);
  if (nav) return nav.label;
  const pattern = PATTERNS.find(([re]) => re.test(path));
  if (pattern) return pattern[1];
  // Admin sub-pages: "/organisation/locations" → "Locations".
  const [section, page] = path.split("/").filter(Boolean);
  if (section && page && SECTION_LABELS[section]) {
    return PAGE_LABELS[page] ?? page.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }
  return "Back";
}

/** Pages that are steps of a task, not places to return to (a submitted form would reopen). */
export const NOT_A_BACK_TARGET = /\/(new|edit|execute)$|\/permits\/new/;
