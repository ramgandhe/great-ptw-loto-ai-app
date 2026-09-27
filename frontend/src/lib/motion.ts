import type { Transition, Variants } from "motion/react";

/** Matches --ease-standard in themes.css: fast start, soft landing. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const motionTransition: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

/** One orchestrated entrance per page: sections appear in reading order. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** No overshoot: data panels should settle, not bounce. Kept under 250ms because these pages are opened many times a day. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
};
