import { KPICard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMXN } from "@/lib/utils/formatters";
import type { AlertLevel } from "@/lib/utils/alerts";

interface DateAlert { level: AlertLevel; daysRemaining: number }

interface AccountMetaCreditProps {
  creditLimit: number;
  currentBalance: number;
  cutDate?: number;
  paymentDueDate?: number;
  annualFee?: number;
  annualFeeDate?: string;
  utilization: number | null;
  alertLevel: AlertLevel;
  cutAlert: DateAlert | null;
  payAlert: DateAlert | null;
  feeAlert: DateAlert | null;
}

function AlertDot({ alert }: { alert: DateAlert | null }) {
  if (!alert || alert.level === "ok") return null;
  return (
    <StatusBadge level={alert.level}>
      {alert.daysRemaining === 0 ? "Hoy" : `${alert.daysRemaining}d`}
    </StatusBadge>
  );
}

export function AccountMetaCredit({
  creditLimit, currentBalance, cutDate, paymentDueDate,
  annualFee, annualFeeDate, utilization, alertLevel,
  cutAlert, payAlert, feeAlert,
}: AccountMetaCreditProps) {
  const available = creditLimit - currentBalance;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KPICard
        label="Línea de crédito"
        value={formatMXN(creditLimit)}
        variant="capital"
      />
      <KPICard
        label="Saldo actual"
        value={formatMXN(currentBalance)}
        variant="debt"
        sub={
          utilization !== null ? (
            <span className="flex items-center gap-1.5 mt-1">
              <StatusBadge level={alertLevel}>{utilization.toFixed(1)}% utilizado</StatusBadge>
            </span>
          ) : undefined
        }
      />
      <KPICard
        label="Disponible"
        value={formatMXN(available)}
        variant="income"
      />
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 space-y-3">
        <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">Fechas clave</p>
        <div className="space-y-2">
          {cutDate && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">Corte</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-[var(--color-foreground)]">Día {cutDate}</span>
                <AlertDot alert={cutAlert} />
              </div>
            </div>
          )}
          {paymentDueDate && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">Pago límite</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-[var(--color-foreground)]">Día {paymentDueDate}</span>
                <AlertDot alert={payAlert} />
              </div>
            </div>
          )}
          {annualFeeDate && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">Anualidad</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-[var(--color-foreground)]">
                  {annualFee ? formatMXN(annualFee) : "Sin cargo"}
                </span>
                <AlertDot alert={feeAlert} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
