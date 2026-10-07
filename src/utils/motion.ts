/**
 * VideoFetch Motion Design Tokens & Variants
 * High-performance, purposeful micro-interactions & layout transitions
 */

export const MOTION_DURATIONS = {
  micro: 0.15,      // Level 1: 150ms for buttons, icons, checkboxes, active states
  component: 0.24,  // Level 2: 240ms for cards, dialogs, dropdowns, tabs
  section: 0.38,    // Level 3: 380ms for page entrances, hero blocks, major views
  state: 0.65,      // Level 4: 650ms for progress transitions, success reveals
} as const;

export const MOTION_EASINGS = {
  standard: [0.16, 1, 0.3, 1] as const,     // Linear / Vercel natural settle
  enter: [0.0, 0.0, 0.2, 1] as const,       // Deceleration on entry
  exit: [0.4, 0.0, 1, 1] as const,          // Acceleration on exit
  state: [0.4, 0.0, 0.2, 1] as const,       // Smooth symmetrical transition
} as const;

// Framer Motion Transition Presets
export const transitionMicro = {
  duration: MOTION_DURATIONS.micro,
  ease: MOTION_EASINGS.standard,
};

export const transitionComponent = {
  duration: MOTION_DURATIONS.component,
  ease: MOTION_EASINGS.standard,
};

export const transitionSection = {
  duration: MOTION_DURATIONS.section,
  ease: MOTION_EASINGS.standard,
};

// Reusable Variants
export const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: transitionSection },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: MOTION_EASINGS.exit } },
};

export const modalBackdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: MOTION_EASINGS.enter } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: MOTION_EASINGS.exit } },
};

export const modalDialogVariants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: transitionComponent },
  exit: { opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.15, ease: MOTION_EASINGS.exit } },
};

export const staggerContainerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: transitionComponent },
};

export const dropdownVariants = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: MOTION_EASINGS.standard } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12, ease: MOTION_EASINGS.exit } },
};
