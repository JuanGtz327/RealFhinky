import { DollarSign, AlertTriangle } from "lucide-react";
import type { IncomeOverdueAlert } from "@/lib/domain/income";

interface Props {
  alerts: IncomeOverdueAlert[];
}

export function IncomeAlertsWidget({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] card-elevated px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-[var(--color-navbar)]" />
          <h3 className="text-sm font-semibold text-[var(--color-navbar)]">Nómina</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-success)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
          Sin pagos pendientes de confirmar
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-warning)]/40 card-elevated px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[var(--color-navbar)]" />
          <h3 className="text-sm font-semibold text-[var(--color-navbar)]">Nómina</h3>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-warning)] animate-pulse" />
      </div>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.sourceId} className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--color-foreground)]">{a.sourceName}</p>
              <p className="text-xs text-[var(--color-muted)]">
                {a.overdueCount === 1 ? "1 pago sin confirmar" : `${a.overdueCount} pagos sin confirmar`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
