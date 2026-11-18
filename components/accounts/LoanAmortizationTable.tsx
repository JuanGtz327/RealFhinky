"use client";

import { formatMXN } from "@/lib/utils/formatters";
import type { AmortizationRow } from "@/lib/domain/types";
import { Check, Clock, TrendingUp } from "lucide-react";

interface Props {
  rows: AmortizationRow[];
  onConfirmPayment?: (month: string) => void;
}

export function LoanAmortizationTable({ rows, onConfirmPayment }: Props) {
  const totalPrincipal = rows.reduce((s, r) => s + r.principal, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const totalPayment = rows.reduce((s, r) => s + r.payment, 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-navbar)] text-white">
            <th className="px-3 py-2.5 text-left font-medium text-xs">#</th>
            <th className="px-3 py-2.5 text-left font-medium text-xs">Mes</th>
            <th className="px-3 py-2.5 text-right font-medium text-xs">Pago</th>
            <th className="px-3 py-2.5 text-right font-medium text-xs">Capital</th>
            <th className="px-3 py-2.5 text-right font-medium text-xs">Interés</th>
            <th className="px-3 py-2.5 text-right font-medium text-xs">Saldo</th>
            <th className="px-3 py-2.5 text-center font-medium text-xs">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((row) => {
            const rowClass = row.isCurrent
              ? "row-highlight-current"
              : row.isPast
              ? "bg-[var(--color-surface)] opacity-70"
              : "bg-[var(--color-surface)]";

            const monthClass = row.isCurrent
              ? "px-3 py-2 font-mono text-xs font-bold text-[var(--color-accent)]"
              : !row.isPast
              ? "px-3 py-2 font-mono text-xs italic text-[var(--color-muted)]"
              : "px-3 py-2 font-mono text-xs text-[var(--color-foreground)]";

            return (
              <tr key={row.month} className={rowClass}>
                <td className="px-3 py-2 text-[var(--color-muted)] text-xs">{row.paymentNumber}</td>
                <td className={monthClass}>{row.month}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-[var(--color-foreground)]">
                  {row.actualPayment !== undefined && row.actualPayment !== row.payment ? (
                    <span className="flex items-center justify-end gap-1">
                      <span className="line-through text-[var(--color-muted)]">{formatMXN(row.payment)}</span>
                      <span className="text-[var(--color-success)]">{formatMXN(row.actualPayment)}</span>
                    </span>
                  ) : (
                    formatMXN(row.payment)
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-[var(--color-foreground)]">
                  {formatMXN(row.principal)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-[var(--color-muted)]">
                  {formatMXN(row.interest)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-[var(--color-foreground)]">
                  {formatMXN(row.remainingBalance)}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.isActual ? (
                    <span className="inline-flex items-center gap-1 text-[var(--color-success)] text-xs">
                      <Check className="w-3 h-3" /> Pagado
                    </span>
                  ) : row.isCurrent ? (
                    onConfirmPayment ? (
                      <button
                        onClick={() => onConfirmPayment(row.month)}
                        className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)] text-white hover:brightness-95"
                      >
                        Confirmar
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--color-warning)] text-xs">
                        <Clock className="w-3 h-3" /> Pendiente
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[var(--color-muted)] text-xs italic">
                      <TrendingUp className="w-3 h-3" /> Proyectado
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-[var(--color-navbar)] text-white font-semibold">
            <td colSpan={2} className="px-3 py-2.5 text-xs">Totales</td>
            <td className="px-3 py-2.5 text-right font-mono text-xs">{formatMXN(totalPayment)}</td>
            <td className="px-3 py-2.5 text-right font-mono text-xs">{formatMXN(totalPrincipal)}</td>
            <td className="px-3 py-2.5 text-right font-mono text-xs">{formatMXN(totalInterest)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
