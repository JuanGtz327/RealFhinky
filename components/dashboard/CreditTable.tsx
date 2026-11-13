import { formatMXN } from "@/lib/utils/formatters";
import { CreditCard, Landmark } from "lucide-react";
import type { AlertLevel } from "@/lib/utils/alerts";
import { AccountCardGrid, SummaryCard, UtilizationBar } from "./AccountCardGrid";

interface CreditAccount {
  id: string;
  name: string;
  bank: string;
  credit_limit: number;
  current_balance: number;
  available: number;
  utilization_pct: number;
  utilization_level: AlertLevel;
}

interface CreditCardsProps {
  accounts: CreditAccount[];
}

const utilBadge: Record<AlertLevel, string> = {
  ok:      "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20",
  danger:  "bg-[var(--color-danger)]/10  text-[var(--color-danger)]  border-[var(--color-danger)]/20",
};

const utilBar: Record<AlertLevel, string> = {
  ok:      "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger:  "bg-[var(--color-danger)]",
};

const utilText: Record<AlertLevel, string> = {
  ok:      "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger:  "text-[var(--color-danger)]",
};

export function CreditTable({ accounts }: CreditCardsProps) {
  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);
  const totalLimit   = accounts.reduce((s, a) => s + a.credit_limit, 0);
  const totalFree    = accounts.reduce((s, a) => s + a.available, 0);

  return (
    <AccountCardGrid
      accounts={accounts}
      columns={2}
      summaryCard={
        <SummaryCard label="Total crédito">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-2xl font-bold text-[var(--color-foreground)] tabular-nums">{formatMXN(totalBalance)}</p>
            <div className="flex gap-4 shrink-0">
              <div className="flex flex-col items-end">
                <span className="text-xs text-[var(--color-muted)]">Línea</span>
                <span className="text-sm font-semibold text-[var(--color-foreground)]">{formatMXN(totalLimit)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-[var(--color-muted)]">Disponible</span>
                <span className="text-sm font-semibold text-[var(--color-foreground)]">{formatMXN(totalFree)}</span>
              </div>
            </div>
          </div>
        </SummaryCard>
      }
      getIcon={(acc) =>
        acc.credit_limit === 0
          ? <Landmark className="w-3.5 h-3.5 text-[var(--color-muted)]" />
          : <CreditCard className="w-3.5 h-3.5 text-[var(--color-accent)]" />
      }
      getBadge={(acc) =>
        acc.credit_limit > 0 ? (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${utilBadge[acc.utilization_level]}`}>
            {acc.utilization_pct.toFixed(0)}%
          </span>
        ) : null
      }
      getBalance={(acc) => acc.current_balance}
      renderStats={(acc) =>
        acc.credit_limit > 0 ? (
          <div className="pt-2 border-t border-[var(--color-border)]/50 space-y-1.5">
            <UtilizationBar pct={acc.utilization_pct} barColor={utilBar[acc.utilization_level]} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">Disponible</span>
              <span className={`text-xs font-semibold ${utilText[acc.utilization_level]}`}>{formatMXN(acc.available)}</span>
            </div>
          </div>
        ) : null
      }
    />
  );
}
