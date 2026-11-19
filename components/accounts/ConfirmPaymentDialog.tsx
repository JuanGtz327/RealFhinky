"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import SlideToConfirm from "@/components/kokonutui/slide-to-confirm";
import { formatMXN, formatMonthLabel } from "@/lib/utils/formatters";
import { roundCents } from "@/lib/utils/msi";
import { CreditCard, CalendarDays, StickyNote, X } from "lucide-react";
import type { CyclePayment } from "@/lib/types";

interface DebitAccountOption {
  id: string;
  name: string;
  bank: string;
}

interface ConfirmPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  cycleMonth: string;
  amountDue: number;
  existingPayment?: CyclePayment | null;
  debitAccounts?: DebitAccountOption[];
}

export function ConfirmPaymentDialog({
  open,
  onClose,
  accountId,
  cycleMonth,
  amountDue,
  existingPayment,
  debitAccounts = [],
}: ConfirmPaymentDialogProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const computedDue = roundCents(amountDue);

  const [cycleTotal, setCycleTotal] = useState(
    existingPayment?.confirmed_cycle_total != null
      ? String(roundCents(existingPayment.confirmed_cycle_total))
      : String(computedDue)
  );
  const parsedCycleTotal = roundCents(parseFloat(cycleTotal) || 0);
  const totalDiffers = parsedCycleTotal !== computedDue;

  const [amountPaid, setAmountPaid] = useState(
    existingPayment
      ? String(roundCents(existingPayment.amount_paid))
      : String(computedDue)
  );
  const [paidDate, setPaidDate] = useState(existingPayment?.paid_date ?? today);
  const [notes, setNotes] = useState(existingPayment?.notes ?? "");
  const [paidFromAccountId, setPaidFromAccountId] = useState<string>(
    existingPayment?.paid_from_account_id ?? debitAccounts[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  const monthLabel = formatMonthLabel(cycleMonth);
  const parsedAmount = roundCents(parseFloat(amountPaid) || 0);
  const isPartial = parsedAmount > 0 && parsedAmount < parsedCycleTotal;

  const handleCycleTotalChange = (val: string) => {
    setCycleTotal(val);
    if (!existingPayment) {
      setAmountPaid(val);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    const paid = parseFloat(amountPaid);
    if (isNaN(paid) || paid <= 0) throw new Error("Monto inválido");
    if (!paidDate.match(/^\d{4}-\d{2}-\d{2}$/)) throw new Error("Fecha inválida");

    const confirmedCycleTotal = totalDiffers ? parsedCycleTotal : null;

    if (existingPayment) {
      const res = await fetch(`/api/cycle-payments/${existingPayment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_paid: paid,
          paid_date: paidDate,
          notes: notes || undefined,
          confirmed_cycle_total: confirmedCycleTotal,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar pago");
      }
    } else {
      const res = await fetch("/api/cycle-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          cycle_month: cycleMonth,
          amount_due: parsedCycleTotal,
          amount_paid: paid,
          paid_date: paidDate,
          notes: notes || undefined,
          paid_from_account_id: paidFromAccountId || undefined,
          confirmed_cycle_total: confirmedCycleTotal,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al registrar pago");
      }
    }

    await new Promise((r) => setTimeout(r, 600));
    router.refresh();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 ring-0 border-0" showCloseButton={false}>
        {/* Header charcoal */}
        <div className="bg-[var(--color-navbar)] px-5 py-4 flex items-start justify-between border-b-[3px] border-[var(--color-accent)]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <CreditCard className="w-4 h-4 text-[var(--color-accent)]" />
              <DialogTitle className="text-base font-semibold text-white">
                {existingPayment ? "Actualizar pago" : "Confirmar pago"}
              </DialogTitle>
            </div>
            <p className="text-xs text-white/50 pl-6">Ciclo {monthLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          {/* Total del ciclo — editable */}
          <div className="px-5 py-4">
            <FormField label="Total del ciclo (estado de cuenta)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)] pointer-events-none">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cycleTotal}
                  onChange={(e) => handleCycleTotalChange(e.target.value)}
                  className="h-8 pl-6 font-mono font-bold"
                />
              </div>
            </FormField>
            <p className="text-xs text-[var(--color-muted)] mt-1.5">
              Calculado por Finkhy: {formatMXN(computedDue)}
              {totalDiffers && (
                <span className="ml-1 text-[var(--color-warning)]">
                  (dif: {formatMXN(Math.abs(parsedCycleTotal - computedDue))})
                </span>
              )}
            </p>
          </div>

          {/* Divisor naranja */}
          <div className="h-[2px] mx-5 rounded-full bg-[var(--color-accent)]" />

          {/* Monto pagado + Fecha */}
          <div className="px-5 pt-4 pb-4 space-y-4">
            <FormField label="Monto pagado" error={error ?? undefined}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)] pointer-events-none">$</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="h-8 pl-6"
                />
                {isPartial && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-warning)] font-medium pointer-events-none">
                    Parcial
                  </span>
                )}
              </div>
            </FormField>

            <FormField label="Fecha de pago">
              <div className="relative">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)] pointer-events-none" />
                <Input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="h-8 pl-8"
                />
              </div>
            </FormField>

            {debitAccounts.length > 0 && !existingPayment && (
              <FormField label="Pagado desde">
                <select
                  value={paidFromAccountId}
                  onChange={(e) => setPaidFromAccountId(e.target.value)}
                  className="select-field h-8 pl-2.5 pr-9 py-1"
                >
                  {debitAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} · {acc.bank}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </div>

          {/* Divisor naranja */}
          <div className="h-[2px] mx-5 rounded-full bg-[var(--color-accent)]" />

          {/* Notas + SlideToConfirm */}
          <div className="px-5 pt-4 pb-5 space-y-4">
            <FormField label="Notas (opcional)">
              <div className="relative">
                <StickyNote className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)] pointer-events-none" />
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pago total, mínimo, etc."
                  className="h-8 pl-8"
                />
              </div>
            </FormField>

            <SlideToConfirm
              label={
                existingPayment
                  ? `Desliza para actualizar • ${formatMXN(parsedAmount)}`
                  : `Desliza para confirmar pago • ${formatMXN(parsedAmount)}`
              }
              confirmingLabel="Registrando"
              doneLabel="Pago registrado"
              resetAfter={null}
              onConfirm={handleConfirm}
              className="w-full max-w-full"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
