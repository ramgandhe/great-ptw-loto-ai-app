import type { Transition, Variants } from "motion/react";

export const motionTransition: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};
