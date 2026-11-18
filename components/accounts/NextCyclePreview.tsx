"use client";

import { useState } from "react";
import { formatMXN, formatMonthLabel } from "@/lib/utils/formatters";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChevronLeft, ChevronRight, Scissors, CalendarRange, ShoppingBag, ArrowDownLeft, Tag, CheckCircle2, AlertCircle, Undo2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computePaymentStatus } from "@/lib/domain/payments";
import { ConfirmPaymentDialog } from "@/components/accounts/ConfirmPaymentDialog";
import { ConfirmPaymentButton } from "@/components/accounts/ConfirmPaymentButton";
import type { CyclePayment } from "@/lib/types";

export interface NextCycleMsiItem {
  merchant: string;
  amount: number;
  installmentNum: number;
  totalMonths: number;
}

export interface NextCycleDirectItem {
  merchant: string;
  amount: number;
  date: string;
  category?: string;
  isProjected?: boolean;
}

export interface NextCycleCreditItem {
  merchant: string;
  amount: number;
  date: string;
}

export interface NextCycleRecurringItem {
  chargeId: string;
  name: string;
  amount: number;
  category?: string;
  isConfirmed: boolean;
}

export interface BillingCycle {
  cycleMonth: string;
  msiItems: NextCycleMsiItem[];
  directItems: NextCycleDirectItem[];
  creditItems: NextCycleCreditItem[];
  recurringItems?: NextCycleRecurringItem[];
  isCurrent: boolean;
  payment?: CyclePayment | null;
}

interface NextCyclePreviewProps {
  cycles: BillingCycle[];
  effectiveMonth: string;
  cutDate?: number;
  accountId: string;
}

export function NextCyclePreview({ cycles, effectiveMonth, cutDate, accountId }: NextCyclePreviewProps) {
  const defaultIndex = Math.max(0, cycles.findIndex((c) => c.isCurrent));
  const [idx, setIdx] = useState(defaultIndex);
  const [dialogOpen, setDialogOpen] = useState(false);

  const cycle = cycles[idx];
  const recurringTotal = (cycle.recurringItems ?? []).reduce((s, i) => s + i.amount, 0);
  const charges = cycle.msiItems.reduce((s, i) => s + i.amount, 0) + cycle.directItems.reduce((s, i) => s + i.amount, 0) + recurringTotal;
  const credits = (cycle.creditItems ?? []).reduce((s, i) => s + i.amount, 0);
  const total = charges - credits;
  const hasItems = cycle.msiItems.length > 0 || cycle.directItems.length > 0 || (cycle.creditItems ?? []).length > 0 || (cycle.recurringItems ?? []).length > 0;
  const isPast   = cycle.cycleMonth < effectiveMonth;
  const isFuture = cycle.cycleMonth > effectiveMonth;

  const footerLabel = isPast ? "Total facturado" : isFuture ? "Total proyectado" : "Total próximo corte";
  const payStatus = computePaymentStatus(cycle.payment, total);
  // Solo ciclos cerrados (pasados) se pueden confirmar — el ciclo actual sigue abierto
  const canConfirm = isPast;

  const handleDeletePayment = async () => {
    if (!cycle.payment) return;
    await fetch(`/api/cycle-payments/${cycle.payment.id}`, { method: "DELETE" });
    // Reload the page to reflect the change
    window.location.reload();
  };

  return (
    <div className="flex flex-col rounded-lg border border-[var(--color-border)] overflow-hidden h-[560px]">
      {/* Header — h-[76px] espejo del card MSI */}
      <div className="px-4 h-[76px] flex items-stretch py-3 gap-3 shrink-0 bg-[var(--color-navbar)]">

        {/* Columna izquierda: navegación < mes > + estado centrado */}
        <div className="flex flex-col justify-between items-center w-[240px] shrink-0">
          <div className="flex items-center gap-1">
            <Button size="icon-sm" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="disabled:opacity-25">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-sm font-semibold text-white whitespace-nowrap px-1.5">
              {formatMonthLabel(cycle.cycleMonth)}
            </span>
            <Button size="icon-sm" onClick={() => setIdx((i) => Math.min(cycles.length - 1, i + 1))} disabled={idx === cycles.length - 1} className="disabled:opacity-25">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {cycle.isCurrent && <StatusBadge variant="accent">Actual</StatusBadge>}
            {isPast   && <StatusBadge variant="muted">Pasado</StatusBadge>}
            {isFuture && <StatusBadge variant="ok">Futuro</StatusBadge>}
            {idx !== defaultIndex && (
              <button
                onClick={() => setIdx(defaultIndex)}
                className="flex items-center gap-0.5 text-[10px] text-[var(--color-accent)] hover:text-white transition-colors leading-none"
              >
                <Undo2 className="w-2.5 h-2.5" />
                Hoy
              </button>
            )}
          </div>
        </div>

        {/* Separador */}
        <div className="w-px bg-white/10 shrink-0 my-0.5" />

        {/* Columna derecha: (label+monto junto a botón) / sub-info */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Fila 1: KPI a la izquierda, acción a la derecha — alineados por el alto del botón */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-white/50 leading-none mb-0.5">{footerLabel}</p>
              <span className="font-mono font-semibold text-[var(--color-accent)] leading-none">{formatMXN(total)}</span>
            </div>
            {canConfirm && (
              <ConfirmPaymentButton onClick={() => setDialogOpen(true)} variant="dark" className="shrink-0" />
            )}
          </div>
          {/* Fila 2: sub-info */}
          <p className="text-xs text-white/40 leading-none">
            {cycle.msiItems.length} MSI · {cycle.directItems.length} compras
            {cutDate && <span className="text-white/30"> · día {cutDate}</span>}
            {(cycle.creditItems ?? []).length > 0 && (
              <span className="text-[var(--color-success)]/70"> · −{formatMXN(credits)}</span>
            )}
          </p>
        </div>

      </div>

      {/* Items */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--color-surface)]">
        {hasItems ? (
          <div className="divide-y divide-[var(--color-border)]">
            {cycle.msiItems.map((item, i) => (
              <div key={`msi-${i}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5 text-[var(--color-accent)]/60 shrink-0" />
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{item.merchant}</p>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5 pl-5">
                    Cuota {item.installmentNum} de {item.totalMonths}
                  </p>
                </div>
                <StatusBadge variant="msi">MSI</StatusBadge>
                <p className="font-mono text-sm text-[var(--color-foreground)] shrink-0 w-24 text-right">
                  {formatMXN(item.amount)}
                </p>
              </div>
            ))}
            {cycle.directItems.map((item, i) => (
              <div key={`direct-${i}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.category === "Anualidad"
                      ? <Tag className="w-3.5 h-3.5 text-[var(--color-warning)] shrink-0" />
                      : <ShoppingBag className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                    }
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{item.merchant}</p>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5 pl-5">{item.date}</p>
                </div>
                {item.category === "Anualidad"
                  ? <StatusBadge variant="warning">Anualidad</StatusBadge>
                  : <StatusBadge variant="accent">Compra</StatusBadge>
                }
                <p className="font-mono text-sm text-[var(--color-foreground)] shrink-0 w-24 text-right">
                  {formatMXN(item.amount)}
                </p>
              </div>
            ))}
            {(cycle.recurringItems ?? []).map((item, i) => (
              <div key={`rc-${i}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-[var(--color-muted)] shrink-0" />
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{item.name}</p>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5 pl-5">
                    {item.isConfirmed ? "Confirmado" : "Proyectado"}
                  </p>
                </div>
                <StatusBadge variant={item.isConfirmed ? "ok" : "muted"}>
                  {item.isConfirmed ? "✓" : "~"}
                </StatusBadge>
                <p className={`font-mono text-sm shrink-0 w-24 text-right ${item.isConfirmed ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)]"}`}>
                  {formatMXN(item.amount)}
                </p>
              </div>
            ))}
            {(cycle.creditItems ?? []).map((item, i) => (
              <div key={`credit-${i}`} className="flex items-center justify-between gap-4 px-4 py-3 bg-[var(--color-success)]/5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" />
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{item.merchant}</p>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5 pl-5">{item.date}</p>
                </div>
                <StatusBadge variant="ok">Abono</StatusBadge>
                <p className="font-mono text-sm text-[var(--color-success)] shrink-0 w-24 text-right">
                  −{formatMXN(item.amount)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--color-muted)]">Sin compromisos registrados</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {payStatus.status === "paid" ? (
        <div className="mt-auto shrink-0 px-4 py-4 bg-[var(--color-success)] rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">Pagado</span>
              {cycle.payment?.paid_date && (
                <span className="text-xs text-white/70">{cycle.payment.paid_date}</span>
              )}
            </div>
            <span className="font-mono font-semibold text-white">{formatMXN(payStatus.amountPaid)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-white/60">
              {cycle.msiItems.length} MSI · {cycle.directItems.length} compras
            </p>
            <button
              onClick={handleDeletePayment}
              className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
            >
              <Undo2 className="w-3 h-3" />
              Deshacer
            </button>
          </div>
        </div>
      ) : payStatus.status === "partial" ? (
        <div className="mt-auto shrink-0 px-4 py-4 bg-[var(--color-warning)] rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">Pago parcial</span>
            </div>
            <span className="font-mono font-semibold text-white">{formatMXN(payStatus.amountPaid)} / {formatMXN(payStatus.amountDue)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-white/70">Pendiente: {formatMXN(payStatus.remaining)}</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="text-xs text-white underline hover:no-underline transition-colors"
            >
              Completar pago
            </button>
          </div>
        </div>
      ) : null}

      {dialogOpen && (
        <ConfirmPaymentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          accountId={accountId}
          cycleMonth={cycle.cycleMonth}
          amountDue={total}
          existingPayment={cycle.payment}
        />
      )}
    </div>
  );
}
