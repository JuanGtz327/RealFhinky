"use client";

/**
 * @author: @kokonutui (edited in-place for Finkhy)
 * @description: Empty State — generic empty state with animated entrance
 */

import { motion, MotionConfig } from "motion/react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 px-8 py-14 text-center",
          className
        )}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE_OUT }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-accent)] shadow-sm mb-5"
        >
          {icon}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.18, ease: EASE_OUT }}
          className="font-semibold text-[var(--color-foreground)] text-base mb-1"
        >
          {title}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.24, ease: EASE_OUT }}
          className="text-sm text-[var(--color-muted)] max-w-xs mb-6"
        >
          {description}
        </motion.p>

        {action && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3, ease: EASE_OUT }}
          >
            {action}
          </motion.div>
        )}
      </motion.div>
    </MotionConfig>
  );
}
