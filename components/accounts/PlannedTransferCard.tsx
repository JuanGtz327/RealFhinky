"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmTransferDialog } from "@/components/accounts/ConfirmTransferDialog";
import { NewPlannedTransferModal } from "@/components/accounts/NewPlannedTransferModal";
import { formatMXN } from "@/lib/utils/formatters";
import { computeBlendedTransfer } from "@/lib/domain";
import { useToast } from "@/components/kokonutui/promise-toast";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Pencil, Trash2 } from "lucide-react";
import type { PlannedTransfer, PlannedTransferEntry } from "@/lib/types";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual",
  biweekly: "Quincenal",
  weekly: "Semanal",
  one_time: "Una vez",
  custom: "Personalizado",
};

interface PlannedTransferCardProps {
  transfer: PlannedTransfer;
  currentMonth: string;
  entries: PlannedTransferEntry[];
  className?: string;
}

export function PlannedTransferCard({ transfer, currentMonth, entries, className }: PlannedTransferCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const result = computeBlendedTransfer(transfer, entries);
  const isFullyConfirmed = result.confirmedCount >= result.expectedCount;
  const existingEntry = entries[0] ?? null;
  const isIn = transfer.direction === "in";

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${transfer.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/planned-transfers/${transfer.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Transferencia eliminada", body: `${transfer.name} ha sido eliminada.`, status: "success" });
      router.refresh();
    } else {
      toast({ title: "Error", body: "No se pudo eliminar.", status: "error" });
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        onClick={() => setConfirmOpen(true)}
        className={`rounded-xl border border-[var(--color-border)] card-elevated card-lift flex flex-col gap-3 p-4 cursor-pointer${className ? ` ${className}` : ""}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "rgba(232,100,60,0.12)" }}
            >
              {isIn
                ? <ArrowDownLeft className="w-4 h-4 text-[var(--color-accent)]" />
                : <ArrowUpRight className="w-4 h-4 text-[var(--color-accent)]" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{transfer.name}</p>
              <p className="text-xs text-[var(--color-muted)]">{isIn ? "Entrada" : "Salida"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <StatusBadge variant="accent">{FREQ_LABELS[transfer.frequency] ?? transfer.frequency}</StatusBadge>
            <button
              onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
              className="p-1 rounded text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 rounded text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors disabled:opacity-50"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Amount + status */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-mono text-xl font-bold text-[var(--color-foreground)]">{formatMXN(transfer.base_amount)}</p>
            {result.expectedCount > 1 && (
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                {result.confirmedCount}/{result.expectedCount} confirmadas
              </p>
            )}
          </div>

          {isFullyConfirmed ? (
            <div className="flex items-center gap-1 text-xs text-[var(--color-success)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirmado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
              <Clock className="w-3.5 h-3.5" />
              <span>Pendiente</span>
            </div>
          )}
        </div>
      </div>

      {confirmOpen && (
        <ConfirmTransferDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          transfer={transfer}
          monthStr={currentMonth}
          existingEntry={existingEntry}
        />
      )}

      {editOpen && (
        <NewPlannedTransferModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          accountId={transfer.account_id}
          initial={transfer}
        />
      )}
    </>
  );
}
