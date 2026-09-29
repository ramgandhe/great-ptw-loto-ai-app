"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, CircleX } from "lucide-react";

type Toast = { id: number; message: string; tone: "success" | "error" };

let nextId = 0;
const listeners = new Set<(toast: Toast) => void>();

/** Confirm an action happened ("Permit type added"). Callable from any handler; the shell renders it. */
export function toast(message: string, tone: Toast["tone"] = "success") {
  const item = { id: ++nextId, message, tone };
  listeners.forEach((listener) => listener(item));
}

/** Bottom-right stack, announced politely to screen readers, each toast leaves after 4 s. */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const add = (item: Toast) => {
      setToasts((current) => [...current.slice(-2), item]);
      setTimeout(() => setToasts((current) => current.filter((t) => t.id !== item.id)), 4000);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 print:hidden">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const color = t.tone === "success" ? "var(--act-do)" : "var(--act-fix)";
          const Icon = t.tone === "success" ? CircleCheck : CircleX;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              role={t.tone === "error" ? "alert" : "status"}
              style={{ "--glow": color } as React.CSSProperties}
              className="is-selected pointer-events-auto flex items-start gap-2.5 rounded-xl bg-card px-4 py-3 text-sm font-medium shadow-lg"
            >
              <Icon className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden />
              <span>{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
