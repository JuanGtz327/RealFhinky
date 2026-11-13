"use client";

import { motion } from "motion/react";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}

export function FadeIn({ children, delay = 0, className, y = 8 }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerGridProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export function StaggerGrid({ children, className, staggerDelay = 0.07 }: StaggerGridProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * staggerDelay, ease: [0.23, 1, 0.32, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
