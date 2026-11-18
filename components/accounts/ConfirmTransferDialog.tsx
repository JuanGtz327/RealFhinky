"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import SlideToConfirm from "@/components/kokonutui/slide-to-confirm";
import { formatMXN, formatMonthLabel } from "@/lib/utils/formatters";
import { roundCents } from "@/lib/utils/msi";
import { ArrowUpDown, CalendarDays, StickyNote, X, Trash2 } from "lucide-react";
import type { PlannedTransfer, PlannedTransferEntry } from "@/lib/types";

interface ConfirmTransferDialogProps {
  open: boolean;
  onClose: () => void;
  transfer: PlannedTransfer;
  monthStr: string;
  existingEntry?: PlannedTransferEntry | null;
}

export function ConfirmTransferDialog({ open, onClose, transfer, monthStr, existingEntry }: ConfirmTransferDialogProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState(
    existingEntry ? String(roundCents(existingEntry.amount)) : String(roundCents(transfer.base_amount))
  );
  const [date, setDate] = useState(existingEntry?.date ?? today);
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const monthLabel = formatMonthLabel(monthStr);
  const parsedAmount = roundCents(parseFloat(amount) || 0);
  const dirLabel = transfer.direction === "in" ? "Entrada" : "Salida";

  const handleConfirm = async () => {
    setError(null);
    const paid = parseFloat(amount);
    if (isNaN(paid) || paid <= 0) throw new Error("Monto inválido");
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) throw new Error("Fecha inválida");

    if (existingEntry) {
      const res = await fetch(`/api/planned-transfers/entries/${existingEntry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: paid, date, notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar");
      }
    } else {
      const res = await fetch("/api/planned-transfers/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planned_transfer_id: transfer.id, date, amount: paid, notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al confirmar");
      }
    }

    await new Promise((r) => setTimeout(r, 600));
    router.refresh();
    onClose();
  };

  const handleDelete = async () => {
    if (!existingEntry) return;
    setDeleting(true);
    try {
      await fetch(`/api/planned-transfers/entries/${existingEntry.id}`, { method: "DELETE" });
      router.refresh();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 ring-0 border-0" showCloseButton={false}>
        <div className="bg-[var(--color-navbar)] px-5 py-4 flex items-start justify-between border-b-[3px] border-[var(--color-accent)]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <ArrowUpDown className="w-4 h-4 text-[var(--color-accent)]" />
              <DialogTitle className="text-base font-semibold text-white">
                {existingEntry ? "Actualizar confirmación" : `Confirmar ${dirLabel.toLowerCase()}`}
              </DialogTitle>
            </div>
            <p className="text-xs text-white/50 pl-6">{transfer.name} · {monthLabel} · {dirLabel}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-wider">Monto esperado</span>
            <span className="font-mono font-bold text-lg text-[var(--color-foreground)]">{formatMXN(transfer.base_amount)}</span>
          </div>

          <div className="h-[2px] mx-5 rounded-full bg-[var(--color-accent)]" />

          <div className="px-5 pt-4 pb-4 space-y-4">
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

            <FormField label="Monto real">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)] pointer-events-none">$</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-8 pl-6"
                />
              </div>
            </FormField>

            <FormField label="Fecha">
              <div className="relative">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)] pointer-events-none" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 pl-8"
                />
              </div>
            </FormField>
          </div>

          <div className="h-[2px] mx-5 rounded-full bg-[var(--color-accent)]" />

          <div className="px-5 pt-4 pb-5 space-y-4">
            <FormField label="Notas (opcional)">
              <div className="relative">
                <StickyNote className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)] pointer-events-none" />
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 pl-8"
                />
              </div>
            </FormField>

            <SlideToConfirm
              label={
                existingEntry
                  ? `Desliza para actualizar • ${formatMXN(parsedAmount)}`
                  : `Desliza para confirmar • ${formatMXN(parsedAmount)}`
              }
              confirmingLabel="Registrando"
              doneLabel="Transferencia confirmada"
              resetAfter={null}
              onConfirm={handleConfirm}
              className="w-full max-w-full"
            />

            {existingEntry && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-2 text-xs text-[var(--color-danger)] hover:underline transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? "Eliminando..." : "Eliminar confirmación"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
