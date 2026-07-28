"use client";

import { MotionConfig } from "motion/react";
import { motionTransition } from "@/lib/motion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={motionTransition}>
      <>{children}</>
    </MotionConfig>
  );
}
