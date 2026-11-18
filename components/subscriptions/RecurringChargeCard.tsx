"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmChargeDialog } from "@/components/subscriptions/ConfirmChargeDialog";
import { NewRecurringChargeModal } from "@/components/subscriptions/NewRecurringChargeModal";
import { formatMXN } from "@/lib/utils/formatters";
import { isChargeExpectedInMonth, computeChargeConfirmationStatus } from "@/lib/domain";
import { useToast } from "@/components/kokonutui/promise-toast";
import { Repeat, CheckCircle2, Clock, Minus, Calendar, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import type { RecurringCharge, RecurringChargeEntry, Account } from "@/lib/types";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  custom: "Personalizado",
};

interface RecurringChargeCardProps {
  charge: RecurringCharge;
  currentMonth: string;
  entries: RecurringChargeEntry[];
  accountName: string;
  accounts: Account[];
}

export function RecurringChargeCard({ charge, currentMonth, entries, accountName, accounts }: RecurringChargeCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isExpected = isChargeExpectedInMonth(charge, currentMonth);
  const status = computeChargeConfirmationStatus(charge, entries, currentMonth);
  const existingEntry = entries[0] ?? null;
  const chargeDay = charge.start_date ? parseInt(charge.start_date.slice(8, 10)) : null;

  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = currentMonth === todayMonth;

  const isOverdue = isExpected && status.status !== "confirmed" && isCurrentMonth && chargeDay !== null && chargeDay <= todayDay;
  const isUpcoming = isExpected && status.status !== "confirmed" && isCurrentMonth && chargeDay !== null && chargeDay > todayDay;

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${charge.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/recurring-charges/${charge.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Cargo eliminado", body: `${charge.name} ha sido eliminado.`, status: "success" });
      router.refresh();
    } else {
      toast({ title: "Error", body: "No se pudo eliminar el cargo.", status: "error" });
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        onClick={() => isOverdue && setConfirmOpen(true)}
        className={[
          "rounded-xl card-elevated card-lift flex flex-col gap-3 p-4",
          isOverdue
            ? "border-2 border-[var(--color-warning)] cursor-pointer"
            : "border border-[var(--color-border)]",
        ].join(" ")}
        style={isOverdue ? { animation: "overdueGlow 2s ease-in-out infinite" } : undefined}
      >
        {/* Overdue badge */}
        {isOverdue && (
          <div className="flex items-center gap-1.5 -mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-warning)]">Vencido sin confirmar</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isOverdue ? "bg-[var(--color-warning)]/10" : "bg-[var(--color-accent)]/10"}`}>
              <Repeat className={`w-4 h-4 ${isOverdue ? "text-[var(--color-warning)]" : "text-[var(--color-accent)]"}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{charge.name}</p>
              <p className="text-xs text-[var(--color-muted)] truncate">{accountName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <StatusBadge variant="muted">{FREQ_LABELS[charge.frequency] ?? charge.frequency}</StatusBadge>
            <button
              onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
              className="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Amount + date */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-mono text-xl font-bold text-[var(--color-foreground)]">{formatMXN(charge.base_amount)}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {chargeDay !== null && (
                <span className={`flex items-center gap-1 text-xs ${isOverdue ? "text-[var(--color-warning)]" : "text-[var(--color-muted)]"}`}>
                  <Calendar className="w-3 h-3" />
                  Día {chargeDay}
                </span>
              )}
              {charge.category && <span className="text-xs text-[var(--color-muted)]">{charge.category}</span>}
              {charge.is_variable && <span className="text-xs text-[var(--color-muted)]">Variable</span>}
            </div>
          </div>

          {/* Status */}
          {!isExpected ? (
            <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
              <Minus className="w-3.5 h-3.5" />
              <span>No aplica</span>
            </div>
          ) : status.status === "confirmed" ? (
            <div className="flex items-center gap-1 text-xs text-[var(--color-success)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirmado</span>
            </div>
          ) : isOverdue ? (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
              className="flex items-center gap-1 text-xs text-[var(--color-warning)] font-medium hover:underline transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
              <span>Confirmar</span>
            </button>
          ) : isUpcoming ? (
            <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
              <Clock className="w-3.5 h-3.5" />
              <span>Próximo día {chargeDay}</span>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
              className="flex items-center gap-1 text-xs text-[var(--color-accent)] font-medium hover:underline transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Confirmar</span>
            </button>
          )}
        </div>
      </div>

      {confirmOpen && (
        <ConfirmChargeDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          charge={charge}
          monthStr={currentMonth}
          existingEntry={existingEntry}
        />
      )}

      {editOpen && (
        <NewRecurringChargeModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          accounts={accounts}
          initial={charge}
        />
      )}
    </>
  );
}
