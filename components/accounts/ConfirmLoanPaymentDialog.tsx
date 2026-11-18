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
import { formatMXN } from "@/lib/utils/formatters";
import { roundCents } from "@/lib/utils/msi";
import { Landmark, CalendarDays, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  cycleMonth: string;
  currentBalance: number;
  monthlyPayment: number;
  annualRate: number;
}

export function ConfirmLoanPaymentDialog({
  open,
  onClose,
  accountId,
  cycleMonth,
  currentBalance,
  monthlyPayment,
  annualRate,
}: Props) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [amountPaid, setAmountPaid] = useState(String(roundCents(monthlyPayment)));
  const [paidDate, setPaidDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const amountNum = roundCents(parseFloat(amountPaid) || 0);
  const monthlyRate = annualRate / 100 / 12;
  const interest = roundCents(currentBalance * monthlyRate);
  const principal = roundCents(Math.max(0, amountNum - interest));
  const newBalance = roundCents(Math.max(0, currentBalance - principal));

  const handleConfirm = async () => {
    setError(null);
    const paid = parseFloat(amountPaid);
    if (isNaN(paid) || paid <= 0) throw new Error("Monto inválido");
    if (!paidDate.match(/^\d{4}-\d{2}-\d{2}$/)) throw new Error("Fecha inválida");

    const res = await fetch("/api/loans/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: accountId,
        cycle_month: cycleMonth,
        amount_paid: paid,
        paid_date: paidDate,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Error al confirmar pago");
    }

    await new Promise((r) => setTimeout(r, 600));
    router.refresh();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 ring-0 border-0" showCloseButton={false}>
        <div className="bg-[var(--color-navbar)] px-5 py-4 flex items-start justify-between border-b-[3px] border-[var(--color-accent)]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Landmark className="w-4 h-4 text-[var(--color-accent)]" />
              <DialogTitle className="text-base font-semibold text-white">
                Confirmar pago de préstamo
              </DialogTitle>
            </div>
            <p className="text-xs text-white/50 pl-6">Ciclo {cycleMonth}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          {/* Desglose capital/interés */}
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">Interés del mes</span>
              <span className="font-mono text-[var(--color-foreground)]">{formatMXN(interest)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">A capital</span>
              <span className="font-mono text-[var(--color-success)]">{formatMXN(principal)}</span>
            </div>
          </div>

          <div className="h-[2px] mx-5 rounded-full bg-[var(--color-accent)]" />

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

          <div className="h-[2px] mx-5 rounded-full bg-[var(--color-accent)]" />

          <div className="px-5 pt-4 pb-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-muted)]">Saldo restante después</span>
              <span className="font-mono font-bold" style={{ color: "var(--color-danger)" }}>
                {formatMXN(newBalance)}
              </span>
            </div>

            <SlideToConfirm
              label={`Desliza para confirmar pago • ${formatMXN(amountNum)}`}
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
