"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Circle, Lock, LockOpen, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type PermitStatus = "draft" | "pending" | "approved" | "active" | "closed";

const STAGES: { label: string; pill: string; status: PermitStatus }[] = [
  { label: "Draft", pill: "Draft", status: "draft" },
  { label: "Checks", pill: "Pending approval", status: "pending" },
  { label: "Approved", pill: "Approved", status: "approved" },
  { label: "Isolated", pill: "Isolated", status: "approved" },
  { label: "Work", pill: "Active", status: "active" },
  { label: "Closed", pill: "Closed", status: "closed" },
];

const PILL: Record<PermitStatus, string> = {
  draft: "bg-(--permit-draft-bg) text-(--permit-draft)",
  pending: "bg-(--permit-pending-bg) text-(--permit-pending)",
  approved: "bg-(--permit-approved-bg) text-(--permit-approved)",
  active: "bg-(--permit-active-bg) text-(--permit-active)",
  closed: "bg-(--permit-closed-bg) text-(--permit-closed)",
};

const CHECKS = [
  { text: "SIMOPS: no overlapping work in Bay 3", from: 1 },
  { text: "Gas test: O₂ 20.9%, LEL 0%", from: 1 },
  { text: "HOD approval, S. Kulkarni", from: 2 },
  { text: "Safety officer approval, A. Rao", from: 2 },
];

const ISOLATIONS = [
  { point: "Steam isolation valve SV-12", energy: "Thermal" },
  { point: "MCC panel 3B, feeder 7", energy: "Electrical" },
  { point: "Condensate pump P-4", energy: "Mechanical" },
];

const LOG = [
  { time: "10:40", text: "Old gasket removed, flange faces cleaned", from: 4 },
  { time: "15:20", text: "Area clear, isolations restored, permit closed", from: 5 },
];

const STEP_MS = 2600;

const subscribeNoop = () => () => {};

export function PermitHero() {
  // Read the motion preference only after hydration so server and client markup match.
  const prefersReducedMotion = useReducedMotion();
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const reduceMotion = hydrated && Boolean(prefersReducedMotion);
  // With reduced motion the walkthrough starts paused on the "work active" stage.
  const [chosenStage, setStage] = useState<number | null>(null);
  const [chosenPlaying, setPlaying] = useState<boolean | null>(null);
  const stage = chosenStage ?? (reduceMotion ? 4 : 0);
  const playing = chosenPlaying ?? !reduceMotion;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(
      () => setStage((s) => ((s ?? 0) + 1) % STAGES.length),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, [playing]);

  const current = STAGES[stage];
  const locked = stage === 3 || stage === 4;

  return (
    <figure className="relative mx-auto w-full max-w-md" aria-label="Example permit moving through its lifecycle">
      {/* Carbon copies of a paper permit book, left behind. */}
      <div aria-hidden className="absolute inset-x-6 -top-3 bottom-10 rotate-3 rounded-2xl bg-(--permit-pending-bg) opacity-35" />
      <div aria-hidden className="absolute inset-x-3 -top-1.5 bottom-10 -rotate-2 rounded-2xl bg-(--permit-approved-bg) opacity-30" />

      <div className="relative rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-(--shadow-lg) sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">PTW-HW-0142, Hot work</p>
            <p className="mt-1 font-heading text-lg font-semibold leading-snug">
              Replace flange gasket on steam header
            </p>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={current.pill}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", PILL[current.status])}
            >
              {current.pill}
            </motion.span>
          </AnimatePresence>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-border py-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Location</dt>
            <dd className="mt-0.5 font-medium">Boiler house, Bay 3</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Window</dt>
            <dd className="mt-0.5 font-medium">08:00 to 16:00</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Crew</dt>
            <dd className="mt-0.5 font-medium">4 + 1 contractor</dd>
          </div>
        </dl>

        <ul className="mt-3 space-y-1.5 text-sm">
          {CHECKS.map((check) => {
            const done = stage >= check.from;
            return (
              <li key={check.text} className="flex items-center gap-2">
                {done ? (
                  <Check className="size-4 text-(--status-success)" aria-hidden />
                ) : (
                  <Circle className="size-4 text-muted-foreground/60" aria-hidden />
                )}
                <span className={done ? "" : "text-muted-foreground"}>{check.text}</span>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-4 rounded-xl bg-muted/60 p-3">
          <p className="text-xs font-semibold">Energy isolation</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {ISOLATIONS.map((iso, i) => (
              <li key={iso.point} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ scale: locked ? [1, 1.25, 1] : 1 }}
                    transition={{ delay: locked && stage === 3 ? i * 0.18 : 0 }}
                    className="inline-flex"
                  >
                    {locked ? (
                      <Lock className="size-4 text-(--status-danger)" aria-hidden />
                    ) : stage === 5 ? (
                      <Check className="size-4 text-(--status-success)" aria-hidden />
                    ) : (
                      <LockOpen className="size-4 text-muted-foreground/70" aria-hidden />
                    )}
                  </motion.span>
                  {iso.point}
                </span>
                <span className="text-xs text-muted-foreground">
                  {locked ? "Locked, tried out" : stage === 5 ? "Restored" : iso.energy}
                </span>
              </li>
            ))}
          </ul>

          <AnimatePresence>
            {locked ? (
              <motion.div
                aria-hidden
                initial={{ opacity: 0, y: -24, rotate: -18 }}
                animate={{ opacity: 1, y: 0, rotate: -6 }}
                exit={{ opacity: 0, y: -12, rotate: -14 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
                style={{ transformOrigin: "50% 0%" }}
                className="absolute -top-[4.5rem] right-1 w-[6.5rem] sm:-top-24 overflow-hidden rounded-md border border-black/10 bg-white text-center shadow-(--shadow-md) sm:-right-8"
              >
                <div className="relative bg-[#d4272f] pb-1.5 pt-3 text-[11px] font-extrabold tracking-wider text-white">
                  <span className="absolute left-1/2 top-1 size-1.5 -translate-x-1/2 rounded-full bg-white" />
                  DANGER
                </div>
                <p className="px-1.5 py-1.5 text-[10px] font-bold leading-tight text-[#0b0b0d]">
                  DO NOT OPERATE
                  <span className="mt-0.5 block font-medium text-[#3a3c44]">Locked by A. Rao</span>
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <ol className="mt-4 min-h-12 space-y-1 text-xs">
          {stage < 4 ? (
            <li className="text-muted-foreground">Work can start once every isolation is verified.</li>
          ) : (
            LOG.filter((entry) => stage >= entry.from).map((entry) => (
              <motion.li
                key={entry.time}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-2"
              >
                <span className="font-mono text-muted-foreground">{entry.time}</span>
                <span>{entry.text}</span>
              </motion.li>
            ))
          )}
        </ol>
      </div>

      <figcaption className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={playing ? "Pause permit walkthrough" : "Play permit walkthrough"}
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <ol className="flex flex-1 gap-1" aria-label="Permit stages">
          {STAGES.map((s, i) => (
            <li key={s.label} className="flex-1">
              <button
                type="button"
                aria-pressed={i === stage}
                onClick={() => {
                  setPlaying(false);
                  setStage(i);
                }}
                className="group w-full rounded-md py-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  className={cn(
                    "block h-1 rounded-full transition-colors",
                    i <= stage ? "bg-primary" : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "mt-1.5 block truncate text-[11px]",
                    i === stage ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {s.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
