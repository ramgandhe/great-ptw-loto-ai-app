"use client";

import { useEffect } from "react";

export const LEAVE_MESSAGE = "You have unsaved changes. Leave without saving them?";

/**
 * While `dirty`, leaving the page asks first: closing or reloading the tab, and following an in-app
 * link (caught before Next.js navigates). Links that open a new tab are left alone.
 */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    const click = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.hash)) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    // Capture phase, so the question comes before the link's own navigation.
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
}
