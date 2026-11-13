import { cn } from "@/lib/utils";
import { formatMXN } from "@/lib/utils/formatters";

interface CurrencyCellProps {
  amount: number;
  className?: string;
  dimIfZero?: boolean;
  colorize?: boolean;
}

export function CurrencyCell({ amount, className, dimIfZero, colorize }: CurrencyCellProps) {
  const isZero = amount === 0;
  return (
    <span
      className={cn(
        "font-mono tabular-nums text-sm",
        dimIfZero && isZero && "text-[var(--color-muted)] opacity-50",
        colorize && amount > 0 && "text-[var(--color-success)]",
        colorize && amount < 0 && "text-[var(--color-danger)]",
        !colorize && !isZero && "text-[var(--color-foreground)]",
        className
      )}
    >
      {formatMXN(amount)}
    </span>
  );
}

interface VariationCellProps {
  variation: number | null;
  className?: string;
}

export function VariationCell({ variation, className }: VariationCellProps) {
  if (variation === null) {
    return <span className="text-[var(--color-muted)] text-xs">—</span>;
  }
  const isPositive = variation >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-sm font-medium",
        isPositive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
        className
      )}
    >
      {isPositive ? "▲" : "▼"} {Math.abs(variation).toFixed(1)}%
    </span>
  );
}
