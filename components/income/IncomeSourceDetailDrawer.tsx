"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale/es";
import { Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmIncomeDialog } from "@/components/forecast/ConfirmIncomeDialog";
import { computeExpectedPaymentDates } from "@/lib/domain/income";
import { formatMXN } from "@/lib/utils/formatters";
import { usePreferences } from "@/lib/context/preferences";
import type { IncomeSource, IncomeEntry } from "@/lib/types";
import type { ExpectedPaymentSlot } from "@/lib/domain/income";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  source: IncomeSource;
  entries: IncomeEntry[];
  monthStr: string;
  today: string;
}

export function IncomeSourceDetailDrawer({ open, onOpenChange, source, entries, monthStr, today }: Props) {
  const router = useRouter();
  const { preferences } = usePreferences();
  const allowEarly = preferences.allow_early_confirmation === "true";
  const [confirmSlot, setConfirmSlot] = useState<ExpectedPaymentSlot | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  const slots = computeExpectedPaymentDates(source, monthStr, today, entries);

  const handleDelete = async (entryId: string) => {
    setDeletingId(entryId);
    try {
      await fetch(`/api/income/entries/${entryId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  const fmtDate = (dateStr: string) =>
    format(parseISO(dateStr + "T12:00:00"), "dd MMM", { locale: es });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0 ring-0 border-0" showCloseButton={false}>
          <div className="bg-[var(--color-navbar)] px-5 py-4 flex items-start justify-between border-b-[3px] border-[var(--color-accent)]">
            <div>
              <DialogTitle className="text-base font-semibold text-white">{source.name}</DialogTitle>
              <p className="text-xs text-white/50 mt-0.5">
                {FREQ_LABELS[source.frequency]} · {formatMXN(source.base_amount)}/pago
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-white/40 hover:text-white/80 transition-colors mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            {slots.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                Configura una fecha de inicio para ver los pagos esperados
              </p>
            ) : (
              slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-3">
                  {slot.entry ? (
                    <span className="w-5 h-5 rounded-full bg-[var(--color-success)] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  ) : slot.isPast ? (
                    <span className="w-5 h-5 rounded-full border-2 border-[var(--color-warning)] shrink-0" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-[var(--color-border)] shrink-0" />
                  )}

                  <span className="text-sm text-[var(--color-foreground)] w-16 shrink-0 font-medium">
                    {fmtDate(slot.date)}
                  </span>

                  {slot.entry ? (
                    <>
                      <span className="text-sm font-mono text-[var(--color-success)] flex-1">
                        {formatMXN(slot.entry.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(slot.entry!.id)}
                        disabled={deletingId === slot.entry.id}
                        className="text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : slot.isPast ? (
                    <>
                      <span className="flex-1 text-xs px-2 py-0.5 rounded-full border border-[var(--color-warning)]/30 text-[var(--color-warning)]"
                        style={{ backgroundColor: "rgba(245,158,11,0.08)" }}>
                        Sin confirmar
                      </span>
                      <Button
                        variant="outline"
                        className="text-xs shrink-0"
                        onClick={() => setConfirmSlot(slot)}
                      >
                        Confirmar
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-xs px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted)]">
                        Programado
                      </span>
                      <Button
                        variant="outline"
                        className="text-xs shrink-0"
                        disabled={!allowEarly}
                        onClick={() => setConfirmSlot(slot)}
                      >
                        Confirmar
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {confirmSlot && (
        <ConfirmIncomeDialog
          open={confirmSlot !== null}
          onOpenChange={(v) => { if (!v) setConfirmSlot(null); }}
          source={source}
          initialDate={confirmSlot.date}
          onConfirmed={() => {
            setConfirmSlot(null);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
