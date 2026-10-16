"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmIntent = "neutral" | "warning" | "destructive";

type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: ConfirmIntent;
};

type ConfirmRequest = ConfirmOptions & {
  id: number;
  resolve: (confirmed: boolean) => void;
};

type ConfirmListener = (request: ConfirmRequest) => void;

let nextId = 0;
const listeners = new Set<ConfirmListener>();

export function confirmAction(message: string, options: Omit<ConfirmOptions, "description"> = {}) {
  const action = message.match(/\b(permanently delete|delete|remove|deactivate|archive|cancel)\b/i)?.[1]?.toLowerCase();
  const intent = options.intent ?? (action ? "destructive" : "warning");
  const actionLabel =
    action === "permanently delete" || action === "delete"
      ? "Delete"
      : action === "remove"
        ? "Remove"
        : action === "deactivate"
          ? "Deactivate"
          : action === "archive"
            ? "Archive"
            : action === "cancel"
              ? "Cancel action"
              : "Continue";
  const requestOptions: ConfirmOptions = {
    title: options.title ?? (action === "permanently delete" ? "Confirm permanent deletion" : intent === "destructive" ? `Confirm ${action ?? "this action"}` : "Review before continuing"),
    description: message,
    confirmLabel: options.confirmLabel ?? actionLabel,
    cancelLabel: options.cancelLabel ?? "Cancel",
    intent,
  };

  return new Promise<boolean>((resolve) => {
    const request = { ...requestOptions, id: ++nextId, resolve };
    if (listeners.size === 0) {
      resolve(window.confirm(message));
      return;
    }
    listeners.forEach((listener) => listener(request));
  });
}

export function ConfirmDialogHost() {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const queueRef = useRef<ConfirmRequest[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const active = queue[0] ?? null;

  useEffect(() => {
    const enqueue: ConfirmListener = (request) => setQueue((current) => {
      const next = [...current, request];
      queueRef.current = next;
      return next;
    });
    listeners.add(enqueue);
    return () => {
      listeners.delete(enqueue);
      queueRef.current.forEach((request) => request.resolve(false));
      queueRef.current = [];
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (active && dialog && !dialog.open) dialog.showModal();
  }, [active]);

  const finish = (confirmed: boolean) => {
    if (!active) return;
    active.resolve(confirmed);
    setQueue((current) => {
      const next = current.slice(1);
      queueRef.current = next;
      return next;
    });
  };

  if (!active) return null;
  const Icon = active.intent === "destructive" ? ShieldAlert : AlertTriangle;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="w-[min(28rem,calc(100vw-2rem))] max-w-none overflow-hidden p-0"
      onCancel={(event) => {
        event.preventDefault();
        finish(false);
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${active.intent === "destructive" ? "bg-(--status-danger-bg) text-(--status-danger)" : "bg-(--status-warning-bg) text-(--status-warning)"}`}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="text-base font-semibold">{active.title}</h2>
            <p id={descriptionId} className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">{active.description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" autoFocus onClick={() => finish(false)}>
            {active.cancelLabel}
          </Button>
          <Button
            type="button"
            variant={active.intent === "destructive" ? "destructive" : "default"}
            onClick={() => finish(true)}
          >
            {active.confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
