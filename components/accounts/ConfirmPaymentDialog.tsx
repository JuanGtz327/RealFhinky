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

interface ConfirmPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  cycleMonth: string;
  amountDue: number;
  existingPayment?: CyclePayment | null;
}

export function ConfirmPaymentDialog({
  open,
  onClose,
  accountId,
  cycleMonth,
  amountDue,
  existingPayment,
}: ConfirmPaymentDialogProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const roundedDue = roundCents(amountDue);

  const [amountPaid, setAmountPaid] = useState(
    existingPayment
      ? String(roundCents(existingPayment.amount_paid))
      : String(roundedDue)
  );
  const [paidDate, setPaidDate] = useState(existingPayment?.paid_date ?? today);
  const [notes, setNotes] = useState(existingPayment?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const monthLabel = formatMonthLabel(cycleMonth);
  const parsedAmount = roundCents(parseFloat(amountPaid) || 0);
  const isPartial = parsedAmount > 0 && parsedAmount < roundedDue;

  const handleConfirm = async () => {
    setError(null);
    const paid = parseFloat(amountPaid);
    if (isNaN(paid) || paid <= 0) throw new Error("Monto inválido");
    if (!paidDate.match(/^\d{4}-\d{2}-\d{2}$/)) throw new Error("Fecha inválida");

    if (existingPayment) {
      const res = await fetch(`/api/cycle-payments/${existingPayment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_paid: paid, paid_date: paidDate, notes: notes || undefined }),
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
          amount_due: roundedDue,
          amount_paid: paid,
          paid_date: paidDate,
          notes: notes || undefined,
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
          {/* Total del ciclo */}
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-wider">Total del ciclo</span>
            <span className="font-mono font-bold text-lg text-[var(--color-foreground)]">{formatMXN(roundedDue)}</span>
          </div>

          {/* Divisor naranja — encima de Monto pagado */}
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
          </div>

          {/* Divisor naranja — encima de Notas */}
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
