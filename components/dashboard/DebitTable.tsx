import { formatMXN } from "@/lib/utils/formatters";
import { Landmark, TrendingUp } from "lucide-react";
import { AccountCardGrid } from "./AccountCardGrid";

interface DebitAccount {
  id: string;
  name: string;
  bank: string;
  capital: number;
  yield_rate: number;
  annual_projection: number;
  daily_projection: number;
}

interface DebitCardsProps {
  accounts: DebitAccount[];
  totals: { capital: number; annual_projection: number; daily_projection: number };
}

export function DebitTable({ accounts, totals }: DebitCardsProps) {
  return (
    <AccountCardGrid
      accounts={accounts}
      columns={2}
      viewAllHref="/accounts"
      getIcon={(acc) =>
        acc.yield_rate > 0
          ? <TrendingUp className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          : <Landmark className="w-3.5 h-3.5 text-[var(--color-muted)]" />
      }
      getBalance={(acc) => acc.capital}
      renderStats={(acc) =>
        acc.yield_rate > 0 ? (
          <div className="flex flex-col gap-1 pt-2 border-t border-[var(--color-border)]/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">RAT</span>
              <span className="text-xs font-semibold text-[var(--color-accent)]">{acc.yield_rate.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">Anual</span>
              <span className="text-xs font-semibold text-[var(--color-foreground)]">{formatMXN(acc.annual_projection)}</span>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-[var(--color-border)]/50">
            <span className="text-xs text-[var(--color-muted)]">Sin rendimiento</span>
          </div>
        )
      }
    />
  );
}
