"use client";

import { formatMXN, formatMonthLabel } from "@/lib/utils/formatters";
import SmoothDrawer, { type OrderItem } from "@/components/kokonutui/smooth-drawer";
import { Receipt } from "lucide-react";

interface Installment {
  month: string;
  amount: number;
  num: number;
  paid: boolean;
}

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
  allInstallments: Installment[];
}

export function MsiActiveList({ items }: { items: MsiItem[] }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {items.map((item) => {
        const pct = Math.round((item.paid / item.months) * 100);

        const drawerItems: OrderItem[] = item.allInstallments.map((inst) => ({
          id:     `${item.id}-${inst.month}`,
          name:   formatMonthLabel(inst.month),
          detail: inst.paid ? "Ya pagado" : `Cuota ${inst.num} de ${item.months}`,
          price:  inst.amount,
          badge:  String(inst.num),
          paid:   inst.paid,
        }));

        const pendingTotal = item.allInstallments
          .filter((i) => !i.paid)
          .reduce((s, i) => s + i.amount, 0);

        return (
          <div key={item.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                  <p className="font-medium text-[var(--color-foreground)] truncate">{item.merchant}</p>
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-0.5 pl-5">
                  {item.paid}/{item.months} cuotas pagadas · desde {item.date.substring(0, 7)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-medium text-[var(--color-foreground)]">
                  {formatMXN(item.nextAmount)}<span className="text-[var(--color-muted)] text-xs">/mes</span>
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  Pendiente: {formatMXN(pendingTotal)}
                </p>
              </div>
            </div>

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

            <div className="mt-4">
              <SmoothDrawer
                title={item.merchant}
                description={`${item.paid} pagadas · ${item.remaining} pendientes`}
                items={drawerItems}
                currency="MXN"
                triggerLabel={`Ver todas las cuotas (${item.months}) →`}
                confirmLabel="Cerrar"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
