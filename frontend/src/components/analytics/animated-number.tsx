"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";

/** Shown as-is on first render; counts from the old value only when a figure changes, so the change is noticed. Static under reduced motion. */
export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const format = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    if (reduce || previous.current === null || previous.current === value) {
      node.textContent = format(value);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.4,
      ease: EASE_OUT,
      onUpdate: (latest) => {
        node.textContent = format(latest);
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, decimals, reduce]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("en-GB", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
    </span>
  );
}
