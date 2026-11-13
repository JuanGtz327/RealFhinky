"use client";

import { formatMXN } from "@/lib/utils/formatters";

interface MsiItem {
  id: string;
  merchant: string;
  total: number;
  monthly: number;
  months: number;
  paid: number;
  remaining: number;
  nextAmount: number;
  pendingTotal: number;
  startDate: string;
  date: string;
}

export function MsiActiveList({ items }: { items: MsiItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.round((item.paid / item.months) * 100);
        return (
          <div key={item.id}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--color-foreground)] truncate">{item.merchant}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  {item.paid}/{item.months} cuotas pagadas · desde {item.date.substring(0, 7)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-medium text-[var(--color-foreground)]">
                  {formatMXN(item.nextAmount)}<span className="text-[var(--color-muted)] text-xs">/mes</span>
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  Pendiente: {formatMXN(item.pendingTotal)}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-[var(--color-muted)] mb-1">
                <span>{item.remaining} cuotas restantes</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--color-border)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
