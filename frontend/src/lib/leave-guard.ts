"use client";

import { useEffect } from "react";

export const LEAVE_MESSAGE = "You have unsaved changes. Leave without saving them?";

/**
 * While `dirty`, leaving the page asks first: closing or reloading the tab, following an in-app link
 * (caught before Next.js navigates) and the browser's Back. Links that open a new tab are left alone.
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
    // Browser Back: an extra entry for this same page absorbs the first Back press, so the question
    // can be asked before anything is left. (Next.js copies its own state into the entry.)
    const url = window.location.href;
    window.history.pushState({ ptwLeaveGuard: true }, "", url);
    const back = () => {
      if (window.location.href !== url) return;
      if (window.confirm(LEAVE_MESSAGE)) {
        guarded = false;
        window.history.back();
      } else {
        window.history.pushState({ ptwLeaveGuard: true }, "", url);
      }
    };
    let guarded = true;
    window.addEventListener("beforeunload", unload);
    // Capture phase, so the question comes before the link's own navigation.
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", back);
      // Saved (or otherwise clean) while still here: drop the extra entry so Back works as usual.
      if (guarded && window.location.href === url && (window.history.state as { ptwLeaveGuard?: boolean } | null)?.ptwLeaveGuard) {
        window.history.back();
      }
    };
  }, [dirty]);
}
