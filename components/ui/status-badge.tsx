import { cn } from "@/lib/utils";
import type { AlertLevel } from "@/lib/utils/alerts";

type BadgeVariant = "ok" | "warning" | "danger" | "muted" | "accent" | "msi";

interface StatusBadgeProps {
  variant?: BadgeVariant;
  level?: AlertLevel;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  ok:      "bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30",
  warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)] border-[var(--color-warning)]/30",
  danger:  "bg-[var(--color-danger)]/15  text-[var(--color-danger)]  border-[var(--color-danger)]/30",
  muted:   "bg-[var(--color-border)]     text-[var(--color-muted)]   border-[var(--color-border)]",
  accent:  "bg-[var(--color-accent)]/15  text-[var(--color-accent)]  border-[var(--color-accent)]/30",
  msi:     "bg-[var(--color-accent)]/10  text-[var(--color-accent)]  border-[var(--color-accent)]/20",
};

export function StatusBadge({ variant, level, children, className }: StatusBadgeProps) {
  const resolved = (level ?? variant ?? "muted") as BadgeVariant;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border",
        variantStyles[resolved],
        className
      )}
    >
      {children}
    </span>
  );
}
