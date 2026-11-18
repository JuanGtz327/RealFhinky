import { DollarSign, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { formatMXN } from "@/lib/utils/formatters";
import type { IncomeOverdueAlert } from "@/lib/domain/income";
import Link from "next/link";

interface IncomeSource {
  id: string;
  name: string;
  frequency: "weekly" | "biweekly" | "monthly" | "custom";
  base_amount: number;
  is_active: boolean;
  is_variable: boolean;
  custom_interval_days?: number | null;
}

interface Props {
  alerts: IncomeOverdueAlert[];
  incomeSources?: IncomeSource[];
}

function projectMonthly(source: IncomeSource): number {
  switch (source.frequency) {
    case "weekly":   return source.base_amount * 4;
    case "biweekly": return source.base_amount * 2;
    case "monthly":  return source.base_amount;
    case "custom": {
      const days = source.custom_interval_days;
      return days && days > 0 ? source.base_amount * Math.round(30 / days) : source.base_amount;
    }
  }
}

const FREQ_LABEL: Record<string, string> = {
  weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado",
};

export function IncomeAlertsWidget({ alerts, incomeSources = [] }: Props) {
  const activeSources = incomeSources.filter((s) => s.is_active);

  if (activeSources.length === 0) {
    return (
      <div className="border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6 flex flex-col items-center justify-center gap-2 min-h-32 text-center">
        <DollarSign className="w-6 h-6 text-[var(--color-muted)]" />
        <p className="text-xs text-[var(--color-muted)]">Sin fuentes de ingreso activas</p>
        <Link href="/income" className="text-xs text-[var(--color-accent)] font-medium hover:underline">
          Agregar fuente →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeSources.map((source) => {
        const alert  = alerts.find((a) => a.sourceId === source.id);
        const monthly = projectMonthly(source);
        const hasAlert = !!alert;

        return (
          <Link
            key={source.id}
            href="/income"
            className="border border-[var(--color-border)] bg-[var(--color-surface)] card-lift px-4 py-4 min-h-24 flex items-center justify-between gap-4 hover:border-[var(--color-accent)]/40 transition-colors"
          >
            {/* Status dot + name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center ${hasAlert ? "bg-[var(--color-warning)]/10" : "bg-[var(--color-success)]/10"}`}>
                {hasAlert
                  ? <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                  : <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{source.name}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {FREQ_LABEL[source.frequency]}
                  {source.is_variable && " · Variable"}
                </p>
              </div>
            </div>

            {/* Amount + status */}
            <div className="text-right shrink-0">
              <div className="flex items-center justify-end gap-1.5">
                <TrendingUp className="w-3 h-3 text-[var(--color-success)]" />
                <p className="text-sm font-bold tabular-nums text-[var(--color-foreground)]">
                  {formatMXN(monthly)}<span className="text-xs font-normal text-[var(--color-muted)]">/mes</span>
                </p>
              </div>
              {hasAlert ? (
                <p className="text-xs text-[var(--color-warning)] font-medium">
                  {alert!.overdueCount === 1 ? "1 pago sin confirmar" : `${alert!.overdueCount} sin confirmar`}
                </p>
              ) : (
                <p className="text-xs text-[var(--color-success)]">Al día</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
