"use client";

import { formatMXN } from "@/lib/utils/formatters";
import type { LoanKpis } from "@/lib/domain/types";

interface Props {
  kpis: LoanKpis;
  paymentDueDate?: number;
}

export function AccountMetaLoan({ kpis, paymentDueDate }: Props) {
  const { progress } = kpis;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card-elevated rounded-lg p-4">
        <p className="text-xs text-[var(--color-muted)] mb-1">Monto Original</p>
        <p className="text-lg font-semibold text-[var(--color-foreground)] font-mono">
          {formatMXN(kpis.originalAmount)}
        </p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{kpis.interestRate}% anual</p>
      </div>

      <div className="card-elevated rounded-lg p-4">
        <p className="text-xs text-[var(--color-muted)] mb-1">Saldo Actual</p>
        <p className="text-lg font-semibold font-mono" style={{ color: "var(--color-danger)" }}>
          {formatMXN(kpis.currentBalance)}
        </p>
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-[var(--color-border)]">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${progress.percentComplete}%`, background: "var(--color-success)" }}
            />
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            {progress.percentComplete.toFixed(1)}% pagado
          </p>
        </div>
      </div>

      <div className="card-elevated rounded-lg p-4">
        <p className="text-xs text-[var(--color-muted)] mb-1">Mensualidad</p>
        <p className="text-lg font-semibold text-[var(--color-foreground)] font-mono">
          {formatMXN(kpis.monthlyPayment)}
        </p>
        {paymentDueDate && (
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Día {paymentDueDate} de cada mes
          </p>
        )}
      </div>

      <div className="card-elevated rounded-lg p-4">
        <p className="text-xs text-[var(--color-muted)] mb-1">Progreso</p>
        <p className="text-lg font-semibold text-[var(--color-foreground)]">
          {progress.paymentsMade}/{progress.totalPayments} pagos
        </p>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">
          Liquidación ~{progress.estimatedPayoffDate}
        </p>
      </div>
    </div>
  );
}
