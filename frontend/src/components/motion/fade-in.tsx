"use client";

import { motion } from "motion/react";
import { fadeInVariants, motionTransition } from "@/lib/motion";

export function FadeIn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInVariants}
      transition={motionTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
