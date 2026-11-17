"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/ui/form-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import SlideToConfirm from "@/components/kokonutui/slide-to-confirm";
import { formatMXN, formatMonthLabel } from "@/lib/utils/formatters";
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

  const [amountPaid, setAmountPaid] = useState(
    existingPayment ? String(existingPayment.amount_paid) : String(amountDue)
  );
  const [paidDate, setPaidDate] = useState(
    existingPayment?.paid_date ?? today
  );
  const [notes, setNotes] = useState(existingPayment?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  const monthLabel = formatMonthLabel(cycleMonth);

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
          amount_due: amountDue,
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
    <FormDialog
      open={open}
      onClose={onClose}
      title={existingPayment ? "Actualizar pago" : "Confirmar pago"}
      description={`Ciclo ${monthLabel}`}
    >
      <div className="space-y-5 pt-2 pb-4">
        {/* Resumen del ciclo */}
        <div className="rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-[var(--color-muted)]">Total del ciclo</span>
          <span className="font-mono font-semibold text-[var(--color-foreground)]">{formatMXN(amountDue)}</span>
        </div>

        <FormField label="Monto pagado" error={error ?? undefined}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            className="h-8"
          />
        </FormField>

        <FormField label="Fecha de pago">
          <Input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className="h-8"
          />
        </FormField>

        <FormField label="Notas (opcional)">
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Pago total, mínimo, etc."
            className="h-8"
          />
        </FormField>

        <div ref={slideRef} className="pt-2">
          <SlideToConfirm
            label={existingPayment ? `Desliza para actualizar • ${formatMXN(parseFloat(amountPaid) || 0)}` : `Desliza para confirmar pago • ${formatMXN(parseFloat(amountPaid) || 0)}`}
            confirmingLabel="Registrando"
            doneLabel="Pago registrado"
            resetAfter={null}
            onConfirm={handleConfirm}
            className="w-full max-w-full"
          />
        </div>
      </div>
    </FormDialog>
  );
}
