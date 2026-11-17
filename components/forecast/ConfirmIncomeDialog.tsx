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
import { DollarSign, CalendarDays, StickyNote, X } from "lucide-react";
import type { IncomeSource } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  source: IncomeSource;
  onConfirmed: () => void;
}

export function ConfirmIncomeDialog({ open, onOpenChange, source, onConfirmed }: Props) {
  const router = useRouter();
  const today  = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState(String(source.base_amount));
  const [date,   setDate]   = useState(today);
  const [notes,  setNotes]  = useState("");
  const [error,  setError]  = useState<string | null>(null);

  const parsedAmount = roundCents(parseFloat(amount) || 0);

  const handleConfirm = async () => {
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) throw new Error("Monto inválido");
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/))  throw new Error("Fecha inválida");

    const res = await fetch("/api/income/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        income_source_id: source.id,
        date,
        amount: parsed,
        notes: notes || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Error al confirmar ingreso");
    }

    await new Promise((r) => setTimeout(r, 600));
    router.refresh();
    onConfirmed();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 ring-0 border-0" showCloseButton={false}>
        <div className="bg-[var(--color-navbar)] px-5 py-4 flex items-start justify-between border-b-[3px] border-[var(--color-accent)]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <DollarSign className="w-4 h-4 text-[var(--color-accent)]" />
              <DialogTitle className="text-base font-semibold text-white">
                Confirmar ingreso
              </DialogTitle>
            </div>
            <p className="text-xs text-white/50 pl-6">{source.name}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-white/40 hover:text-white/80 transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-wider">Monto esperado</span>
            <span className="font-mono font-bold text-lg text-[var(--color-foreground)]">{formatMXN(source.base_amount)}</span>
          </div>

          <div className="h-[2px] mx-5 rounded-full bg-[var(--color-accent)]" />

          <div className="px-5 pt-4 pb-4 space-y-4">
            <FormField label="Monto recibido" error={error ?? undefined}>
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
                  placeholder="Nómina quincenal, bono, etc."
                  className="h-8 pl-8"
                />
              </div>
            </FormField>

            <SlideToConfirm
              label={`Desliza para confirmar ingreso · ${formatMXN(parsedAmount)}`}
              confirmingLabel="Registrando"
              doneLabel="Ingreso registrado"
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
