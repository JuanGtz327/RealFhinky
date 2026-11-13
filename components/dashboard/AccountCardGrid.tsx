import { formatMXN } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AccountBase {
  id: string;
  name: string;
  bank: string;
}

interface AccountCardGridProps<T extends AccountBase> {
  accounts: T[];
  columns?: 1 | 2;
  summaryCard?: ReactNode;
  getIcon: (account: T) => ReactNode;
  getBadge?: (account: T) => ReactNode;
  getBalance: (account: T) => number;
  renderStats?: (account: T) => ReactNode;
}

export function AccountCardGrid<T extends AccountBase>({
  accounts,
  columns = 2,
  summaryCard,
  getIcon,
  getBadge,
  getBalance,
  renderStats,
}: AccountCardGridProps<T>) {
  return (
    <div className="space-y-3">
      {summaryCard}

      <div className={cn(
        "grid gap-3",
        columns === 2 ? "grid-cols-2" : "grid-cols-1"
      )}>
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="rounded-xl border border-[var(--color-border)] card-elevated card-lift px-4 py-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-navbar)]/8 shrink-0">
                  {getIcon(acc)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-foreground)] text-sm truncate">{acc.name}</p>
                  <p className="text-xs text-[var(--color-muted)] truncate">{acc.bank}</p>
                </div>
              </div>
              {getBadge?.(acc)}
            </div>

            <p className="text-xl font-bold text-[var(--color-foreground)] mb-2 tabular-nums">
              {formatMXN(getBalance(acc))}
            </p>

            {renderStats?.(acc)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SummaryCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] card-elevated px-5 py-4 border-t-2 border-t-[var(--color-navbar)]">
      <p className="text-xs font-semibold text-[var(--color-navbar)] uppercase tracking-wide mb-2">{label}</p>
      {children}
    </div>
  );
}

export function UtilizationBar({ pct, barColor }: { pct: number; barColor: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--color-bg)] overflow-hidden">
      <div className={cn("h-1.5 rounded-full", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}
