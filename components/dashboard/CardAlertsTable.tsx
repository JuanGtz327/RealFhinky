import { formatMXN } from "@/lib/utils/formatters";
import { CreditCard, AlertTriangle } from "lucide-react";
import type { AlertLevel } from "@/lib/utils/alerts";

interface DateAlert { level: AlertLevel; daysRemaining: number }

interface CardAlert {
  id: string;
  name: string;
  bank: string;
  last4?: string;
  cut_date?: number;
  payment_due_date?: number;
  annual_fee?: number;
  annual_fee_date?: string;
  cut_alert?: DateAlert | null;
  payment_alert?: DateAlert | null;
  fee_alert?: DateAlert | null;
}

interface CardAlertsProps {
  cards: CardAlert[];
}

const alertStyles: Record<AlertLevel, string> = {
  ok:      "text-[var(--color-muted)]",
  warning: "text-[var(--color-warning)] font-semibold",
  danger:  "text-[var(--color-danger)]  font-semibold",
};

const dotStyles: Record<AlertLevel, string> = {
  ok:      "bg-[var(--color-border)]",
  warning: "bg-[var(--color-warning)]",
  danger:  "bg-[var(--color-danger)] animate-pulse",
};

function DateRow({
  label,
  day,
  alert,
}: {
  label: string;
  day?: number;
  alert?: DateAlert | null;
}) {
  if (!day) return null;
  const level = alert?.level ?? "ok";
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs ${alertStyles[level]}`}>Día {day}</span>
        {level !== "ok" && alert && (
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border
            ${level === "danger" ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20" : "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20"}`}>
            <AlertTriangle className="w-3 h-3" />
            {alert.daysRemaining === 0 ? "Hoy" : `${alert.daysRemaining}d`}
          </span>
        )}
      </div>
    </div>
  );
}

export function CardAlertsTable({ cards }: CardAlertsProps) {
  if (cards.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">Sin tarjetas de crédito</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      {cards.map((card) => {
        const hasAlert =
          card.cut_alert?.level !== "ok" ||
          card.payment_alert?.level !== "ok" ||
          card.fee_alert?.level !== "ok";
        const worstLevel: AlertLevel =
          card.payment_alert?.level === "danger" || card.fee_alert?.level === "danger"
            ? "danger"
            : hasAlert ? "warning" : "ok";

        return (
          <div key={card.id}
            className={`rounded-xl border card-elevated card-lift px-5 py-4
              ${worstLevel === "danger"  ? "border-[var(--color-danger)]/40"
              : worstLevel === "warning" ? "border-[var(--color-warning)]/40"
              : "border-[var(--color-border)]"}`}>

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-navbar)]/8">
                  <CreditCard className="w-4 h-4 text-[var(--color-navbar)]" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-foreground)] text-sm">{card.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {card.bank}{card.last4 ? ` ···${card.last4}` : ""}
                  </p>
                </div>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${dotStyles[worstLevel]}`} />
            </div>

            {/* Fechas */}
            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]/50">
              <DateRow label="Fecha de corte"  day={card.cut_date}         alert={card.cut_alert} />
              <DateRow label="Límite de pago"  day={card.payment_due_date} alert={card.payment_alert} />
              {card.annual_fee !== undefined && card.annual_fee > 0 && card.annual_fee_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-muted)]">Anualidad</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs ${alertStyles[card.fee_alert?.level ?? "ok"]}`}>
                      {formatMXN(card.annual_fee)}
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">· {card.annual_fee_date}</span>
                  </div>
                </div>
              )}
              {card.annual_fee === 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-muted)]">Anualidad</span>
                  <span className="text-xs text-[var(--color-success)] font-medium">Sin cargo</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
