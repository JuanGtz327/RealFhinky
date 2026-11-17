"use client";

import { KPICard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMXN } from "@/lib/utils/formatters";
import type { AlertLevel } from "@/lib/utils/alerts";
import { ShieldCheck, ShieldAlert, CreditCard, Wallet, Scissors, CalendarCheck, Tag } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { ReactNode } from "react";

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
  balanceDiff?: number;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(date);
}

function nextDayOfMonthDate(day: number): Date {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), day);
  if (thisMonth > today) return thisMonth;
  return new Date(today.getFullYear(), today.getMonth() + 1, day);
}

function daysLabel(days: number): string {
  if (days < 0) return `hace ${Math.abs(days)}d`;
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `en ${days}d`;
}

interface DateEvent {
  icon: ReactNode;
  label: string;
  mainDate: string;
  daysText: string;
  subText?: string;
  urgency: AlertLevel;
}

export function AccountMetaCredit({
  creditLimit, currentBalance, cutDate, paymentDueDate,
  annualFee, annualFeeDate, utilization, alertLevel,
  cutAlert, payAlert, feeAlert, balanceDiff,
}: AccountMetaCreditProps) {
  const available = creditLimit - currentBalance;
  const hasDiff = balanceDiff !== undefined && Math.abs(balanceDiff) > 1;

  // Build key date events
  const dateEvents: DateEvent[] = [];

  if (cutDate && cutAlert) {
    const date = nextDayOfMonthDate(cutDate);
    dateEvents.push({
      icon: <Scissors className="w-3.5 h-3.5" />,
      label: "Corte",
      mainDate: formatShortDate(date),
      daysText: daysLabel(cutAlert.daysRemaining),
      urgency: cutAlert.level,
    });
  }

  if (paymentDueDate && payAlert) {
    const date = nextDayOfMonthDate(paymentDueDate);
    dateEvents.push({
      icon: <CalendarCheck className="w-3.5 h-3.5" />,
      label: "Pago",
      mainDate: formatShortDate(date),
      daysText: daysLabel(payAlert.daysRemaining),
      urgency: payAlert.level,
    });
  }

  if (annualFeeDate && feeAlert) {
    const date = new Date(annualFeeDate + "T12:00:00");
    const days = feeAlert.daysRemaining;
    dateEvents.push({
      icon: <Tag className="w-3.5 h-3.5" />,
      label: "Anualidad",
      mainDate: formatShortDate(date),
      daysText: daysLabel(days),
      subText: annualFee ? formatMXN(annualFee) : undefined,
      // Only treat as urgent for future approaching dates, not past
      urgency: days >= 0 ? feeAlert.level : "ok",
    });
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KPICard
        label="Línea de crédito"
        value={formatMXN(creditLimit)}
        variant="capital"
        icon={<CreditCard className="w-4 h-4" />}
      />
      <KPICard
        label="Saldo actual"
        value={formatMXN(currentBalance)}
        variant="debt"
        icon={
          balanceDiff !== undefined ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {hasDiff
                    ? <ShieldAlert className="w-4 h-4 text-[var(--color-warning)] cursor-default" />
                    : <ShieldCheck className="w-4 h-4 text-[var(--color-success)] cursor-default" />
                  }
                </TooltipTrigger>
                <TooltipContent side="top">
                  {hasDiff
                    ? (balanceDiff > 0
                        ? `El banco reporta ${formatMXN(balanceDiff)} más que Finkhy — hay gastos no registrados`
                        : `Finkhy calcula ${formatMXN(Math.abs(balanceDiff))} más que el banco — probable diferencia de redondeo en cuotas MSI`)
                    : "Las cuotas pendientes y compras coinciden con el saldo del banco"
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : undefined
        }
        sub={
          utilization !== null ? (
            <span className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge level={alertLevel}>{utilization.toFixed(1)}% utilizado</StatusBadge>
              {hasDiff && (
                <StatusBadge level="warning">
                  {balanceDiff! > 0 ? "+" : ""}{formatMXN(balanceDiff!)} dif.
                </StatusBadge>
              )}
            </span>
          ) : hasDiff ? (
            <span className="flex items-center gap-1.5 mt-1">
              <StatusBadge level="warning">
                {balanceDiff! > 0 ? "+" : ""}{formatMXN(balanceDiff!)} dif.
              </StatusBadge>
            </span>
          ) : undefined
        }
      />
      <KPICard
        label="Disponible"
        value={formatMXN(available)}
        variant="income"
        icon={<Wallet className="w-4 h-4" />}
      />

      {/* Fechas clave — redesigned */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)] mb-3">
          Fechas clave
        </p>
        {dateEvents.length > 0 ? (
          <div className="flex divide-x divide-[var(--color-border)]">
            {dateEvents.map((e, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center px-2 first:pl-0 last:pr-0 gap-1">
                {/* Icon + label */}
                <div className="flex items-center gap-1 text-[var(--color-muted)]">
                  {e.icon}
                  <span className="text-[10px] font-medium uppercase tracking-wide leading-none">
                    {e.label}
                  </span>
                </div>
                {/* Main date */}
                <p className="text-sm font-semibold text-[var(--color-foreground)] leading-tight">
                  {e.mainDate}
                </p>
                {/* Days remaining — color-coded */}
                {e.urgency === "danger" && (
                  <p className="text-[11px] font-semibold text-[var(--color-danger)] leading-tight">
                    {e.daysText}
                  </p>
                )}
                {e.urgency === "warning" && (
                  <p className="text-[11px] font-semibold text-[var(--color-warning)] leading-tight">
                    {e.daysText}
                  </p>
                )}
                {e.urgency === "ok" && (
                  <p className="text-[11px] text-[var(--color-muted)] leading-tight">
                    {e.daysText}
                  </p>
                )}
                {/* Amount subtext (annual fee) */}
                {e.subText && (
                  <p className="text-[10px] text-[var(--color-muted)] leading-tight">
                    {e.subText}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">Sin fechas configuradas</p>
        )}
      </div>
    </div>
  );
}
