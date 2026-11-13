import { formatMXN } from "@/lib/utils/formatters";
import { CreditCard, Landmark } from "lucide-react";
import type { AlertLevel } from "@/lib/utils/alerts";
import { AccountCardGrid, UtilizationBar } from "./AccountCardGrid";

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

interface DebtCardsProps {
  accounts: CreditAccount[];
}

const utilColors: Record<AlertLevel, { bar: string; badge: string; text: string }> = {
  ok:      { bar: "bg-[var(--color-success)]",  badge: "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20",  text: "text-[var(--color-success)]"  },
  warning: { bar: "bg-[var(--color-warning)]",  badge: "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20",  text: "text-[var(--color-warning)]"  },
  danger:  { bar: "bg-[var(--color-danger)]",   badge: "bg-[var(--color-danger)]/10  text-[var(--color-danger)]  border-[var(--color-danger)]/20",   text: "text-[var(--color-danger)]"   },
};

export function DebtTable({ accounts }: DebtCardsProps) {
  return (
    <AccountCardGrid
      accounts={accounts}
      columns={1}
      getIcon={(acc) =>
        acc.credit_limit === 0
          ? <Landmark className="w-3.5 h-3.5 text-[var(--color-muted)]" />
          : <CreditCard className="w-3.5 h-3.5 text-[var(--color-accent)]" />
      }
      getBadge={(acc) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${utilColors[acc.utilization_level].badge}`}>
          {acc.utilization_pct.toFixed(0)}%
        </span>
      )}
      getBalance={(acc) => acc.current_balance}
      renderStats={(acc) =>
        acc.credit_limit > 0 ? (
          <>
            <div className="flex items-baseline gap-2 -mt-1 mb-2">
              <span className="text-sm text-[var(--color-muted)]">
                / {formatMXN(acc.credit_limit)}
              </span>
            </div>
            <UtilizationBar pct={acc.utilization_pct} barColor={utilColors[acc.utilization_level].bar} />
            <p className="text-xs text-[var(--color-muted)] mt-1.5">
              Disponible: <span className={`font-semibold ${utilColors[acc.utilization_level].text}`}>{formatMXN(acc.available)}</span>
            </p>
          </>
        ) : null
      }
    />
  );
}
