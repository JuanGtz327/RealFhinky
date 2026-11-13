import { cn } from "@/lib/utils";

type KPIVariant = "capital" | "debt" | "income" | "expense" | "neutral";

interface KPICardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: KPIVariant;
  className?: string;
}

const styles: Record<KPIVariant, { wrap: string; icon: string; value: string; border: string }> = {
  capital: {
    wrap:   "card-elevated border-[var(--color-border)]",
    border: "border-l-[var(--color-navbar)]",
    icon:   "text-[var(--color-navbar)]",
    value:  "text-[var(--color-foreground)]",
  },
  income: {
    wrap:   "card-elevated border-[var(--color-success)]/30",
    border: "border-l-[var(--color-success)]",
    icon:   "text-[var(--color-success)]",
    value:  "text-[var(--color-success)]",
  },
  debt: {
    wrap:   "card-elevated border-[var(--color-danger)]/30",
    border: "border-l-[var(--color-danger)]",
    icon:   "text-[var(--color-danger)]",
    value:  "text-[var(--color-danger)]",
  },
  expense: {
    wrap:   "card-elevated border-[var(--color-border)]",
    border: "border-l-[var(--color-muted)]",
    icon:   "text-[var(--color-muted)]",
    value:  "text-[var(--color-foreground)]",
  },
  neutral: {
    wrap:   "card-elevated border-[var(--color-border)]",
    border: "border-l-[var(--color-border)]",
    icon:   "text-[var(--color-muted)]",
    value:  "text-[var(--color-foreground)]",
  },
};

export function KPICard({ label, value, sub, icon, variant = "neutral", className }: KPICardProps) {
  const s = styles[variant];
  return (
    <div className={cn(
      "rounded-xl border border-l-4 px-5 py-4 min-h-[88px] flex flex-col justify-between",
      s.wrap, s.border,
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] leading-tight">
          {label}
        </p>
        {icon && <span className={cn("shrink-0", s.icon)}>{icon}</span>}
      </div>
      <p className={cn("text-2xl font-bold leading-tight mt-2", s.value)}>
        {value}
      </p>
      {/* Espacio reservado fijo — sub o vacío, la altura no cambia */}
      <p className="text-xs text-[var(--color-muted)] mt-1 min-h-[16px]">
        {sub ?? ""}
      </p>
    </div>
  );
}
