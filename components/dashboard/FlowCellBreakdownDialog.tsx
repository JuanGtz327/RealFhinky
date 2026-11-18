"use client";

import { FormDialog } from "@/components/ui/form-dialog";
import { formatMXN, formatMonthLabel, formatDate } from "@/lib/utils/formatters";
import { CheckCircle2, Circle, Repeat, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FlowRow } from "@/lib/domain/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: "ingresos" | "gastos";
  month: string;
  row: FlowRow;
  isCurrent: boolean;
  isFuture: boolean;
}

function SectionHeader({ label, total }: { label: string; total: number }) {
  return (
    <div className="flex items-center justify-between pt-4 pb-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--color-foreground)]">{formatMXN(total)}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--color-border)]" />;
}

function InfoRow({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
      <div>
        <span className="text-sm text-[var(--color-foreground)]">{label}</span>
        {sub && <span className="ml-2 text-xs text-[var(--color-muted)]">{sub}</span>}
      </div>
      <span className={`text-sm font-mono ${valueClass ?? "text-[var(--color-foreground)]"}`}>{value}</span>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-[var(--color-muted)] py-2">{text}</p>;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado",
};

export function FlowCellBreakdownDialog({ open, onOpenChange, type, month, row, isCurrent, isFuture }: Props) {
  const title = type === "ingresos"
    ? `Ingresos Totales — ${formatMonthLabel(month)}`
    : `Gastos Totales — ${formatMonthLabel(month)}`;

  const total = type === "ingresos" ? row.ingresos_totales : row.gastos_totales;

  return (
    <FormDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      description={`Total: ${formatMXN(total)}`}
      className="sm:max-w-md"
    >
      {type === "gastos" ? (
        <GastosContent row={row} isCurrent={isCurrent} />
      ) : (
        <IngresosContent row={row} isCurrent={isCurrent} isFuture={isFuture} />
      )}
    </FormDialog>
  );
}

function GastosContent({ row, isCurrent }: { row: FlowRow; isCurrent: boolean }) {
  const router = useRouter();
  const breakdown = row.tarjetasBreakdown ?? [];
  const cardTotal = (c: typeof breakdown[number]) =>
    c.purchases + c.msi + (c.untracked ?? 0) + (c.flow_adjustment ?? 0) + (c.recurringCharges ?? 0);
  const activeCards = breakdown.filter((c) => cardTotal(c) > 0 || isCurrent);
  const tarjetasTotal = breakdown.reduce((s, c) => s + cardTotal(c), 0);
  const loansTotal = row.loans.reduce((s, l) => s + l.amount, 0);
  const activeLoans = row.loans.filter((l) => l.amount > 0);

  // Per-card manual adjustment state
  const [adjustments, setAdjustments] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of breakdown) {
      init[c.id] = c.flow_adjustment != null ? String(c.flow_adjustment) : "";
    }
    return init;
  });
  const [savingCard, setSavingCard] = useState<string | null>(null);

  async function saveAdjustment(cardId: string) {
    const raw = adjustments[cardId];
    const value = raw === "" ? null : parseFloat(raw);
    if (raw !== "" && isNaN(value!)) return;
    setSavingCard(cardId);
    await fetch(`/api/accounts/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_adjustment: value }),
    });
    setSavingCard(null);
    router.refresh();
  }

  // Otros gastos state
  const [otrosGastos, setOtrosGastos] = useState(row.otrosGastos ?? []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [savingOtros, setSavingOtros] = useState(false);

  const otrosTotal = otrosGastos.reduce((s, a) => s + a.amount, 0);

  async function addOtroGasto() {
    const amount = parseFloat(newAmount);
    if (!newDesc.trim() || isNaN(amount) || amount <= 0) return;
    setSavingOtros(true);
    const res = await fetch("/api/flow-adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: row.month, description: newDesc.trim(), amount }),
    });
    if (res.ok) {
      const { adjustment } = await res.json();
      setOtrosGastos((p) => [...p, adjustment]);
      setNewDesc("");
      setNewAmount("");
      setShowAddForm(false);
      router.refresh();
    }
    setSavingOtros(false);
  }

  async function deleteOtroGasto(id: string) {
    await fetch(`/api/flow-adjustments/${id}`, { method: "DELETE" });
    setOtrosGastos((p) => p.filter((a) => a.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-1 pb-2">
      {/* Tarjetas */}
      <SectionHeader label="Tarjetas de Crédito" total={tarjetasTotal} />
      <Divider />
      {activeCards.length === 0 ? (
        <EmptyNote text="Sin gastos en tarjetas este mes" />
      ) : (
        activeCards.map((card) => {
          const adj = parseFloat(adjustments[card.id] || "0") || 0;
          const cardTotal = card.purchases + card.msi + (card.untracked ?? 0) + (card.recurringCharges ?? 0) + adj;
          return (
            <div key={card.id} className="pt-2 pb-1">
              <p className="text-sm font-medium text-[var(--color-foreground)] mb-1">
                {card.name}
                <span className="text-xs text-[var(--color-muted)] ml-1.5">· {card.bank}</span>
              </p>
              {card.purchases > 0 && (
                <InfoRow label="Compras directas" value={formatMXN(card.purchases)} />
              )}
              {card.msi > 0 && (
                <InfoRow label="Cuotas MSI" value={formatMXN(card.msi)} />
              )}
              {(card.untracked ?? 0) > 0 && (
                <InfoRow
                  label="Deuda pre-onboarding (auto)"
                  value={formatMXN(card.untracked!)}
                  valueClass="text-[var(--color-warning)]"
                />
              )}
              {(card.recurringChargesDetail ?? []).map((rc) => (
                <div key={rc.chargeId} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                  <div className="flex items-center gap-1.5">
                    <Repeat className="w-3 h-3 text-[var(--color-muted)]" />
                    <span className="text-sm text-[var(--color-foreground)]">{rc.name}</span>
                    {rc.confirmed
                      ? <span className="text-[10px] text-[var(--color-success)]">confirmado</span>
                      : <span className="text-[10px] text-[var(--color-muted)] italic">proyectado</span>
                    }
                  </div>
                  <span className={`text-sm font-mono ${rc.confirmed ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)] italic"}`}>
                    {formatMXN(rc.amount)}
                  </span>
                </div>
              ))}
              {isCurrent && (
                <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                  <span className="text-sm text-[var(--color-foreground)]">Ajuste manual</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={adjustments[card.id] ?? ""}
                      onChange={(e) => setAdjustments((p) => ({ ...p, [card.id]: e.target.value }))}
                      onBlur={() => saveAdjustment(card.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveAdjustment(card.id); }}
                      disabled={savingCard === card.id}
                      className="w-28 h-7 text-right text-sm font-mono border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg)] text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
                    />
                    {savingCard === card.id && (
                      <span className="text-[10px] text-[var(--color-muted)]">guardando…</span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-[var(--color-muted)]">Subtotal</span>
                <span className="text-sm font-semibold font-mono text-[var(--color-foreground)]">
                  {formatMXN(cardTotal)}
                </span>
              </div>
            </div>
          );
        })
      )}

      {/* Préstamos */}
      <SectionHeader label="Préstamos" total={loansTotal} />
      <Divider />
      {activeLoans.length === 0 ? (
        <EmptyNote text="Sin cuotas de préstamo este mes" />
      ) : (
        activeLoans.map((loan) => (
          <InfoRow key={loan.account_id} label={loan.name} value={formatMXN(loan.amount)} />
        ))
      )}

      {/* Transferencias salientes (solo meses no-actuales donde suman a gastos) */}
      {row.transferencias > 0 && (
        <>
          <SectionHeader label="Transferencias salientes" total={row.transferencias} />
          <Divider />
          {(row.transferenciasDetail ?? []).map((t, i) => (
            <InfoRow key={i} label={t.merchant || t.accountName} value={formatMXN(t.amount)} sub={`${t.accountName} · ${formatDate(t.date)}`} />
          ))}
          {(row.plannedTransfersOutDetail ?? []).map((pt) => (
            <div key={pt.transferId} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="w-3 h-3 text-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-foreground)]">{pt.name}</span>
                {pt.confirmed
                  ? <span className="text-[10px] text-[var(--color-success)]">confirmado</span>
                  : <span className="text-[10px] text-[var(--color-muted)] italic">proyectado</span>
                }
              </div>
              <span className={`text-sm font-mono ${pt.confirmed ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)] italic"}`}>
                {formatMXN(pt.amount)}
              </span>
            </div>
          ))}
          {(row.transferenciasDetail ?? []).length === 0 && (row.plannedTransfersOutDetail ?? []).length === 0 && (
            <EmptyNote text="Sin transferencias este mes" />
          )}
        </>
      )}

      {/* Otros gastos */}
      <SectionHeader label="Otros Gastos" total={otrosTotal} />
      <Divider />
      {otrosGastos.length === 0 && !showAddForm && (
        <EmptyNote text="Sin gastos adicionales registrados" />
      )}
      {otrosGastos.map((a) => (
        <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
          <span className="text-sm text-[var(--color-foreground)]">{a.description}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-[var(--color-foreground)]">{formatMXN(a.amount)}</span>
            <button
              onClick={() => deleteOtroGasto(a.id)}
              className="text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors text-xs leading-none"
              aria-label="Eliminar"
            >
              ×
            </button>
          </div>
        </div>
      ))}
      {showAddForm && (
        <div className="flex items-center gap-2 py-2">
          <input
            type="text"
            placeholder="Descripción"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="flex-1 h-7 text-sm border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg)] text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-accent)]"
            autoFocus
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addOtroGasto(); if (e.key === "Escape") setShowAddForm(false); }}
            className="w-24 h-7 text-right text-sm font-mono border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg)] text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={addOtroGasto}
            disabled={savingOtros}
            className="h-7 px-2 text-xs rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            ✓
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewDesc(""); setNewAmount(""); }}
            className="h-7 px-2 text-xs rounded border border-[var(--color-border)] text-[var(--color-muted)]"
          >
            ✕
          </button>
        </div>
      )}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-1 text-xs text-[var(--color-accent)] hover:underline"
        >
          + Agregar gasto
        </button>
      )}
    </div>
  );
}

function IngresosContent({ row, isCurrent, isFuture }: { row: FlowRow; isCurrent: boolean; isFuture: boolean }) {
  const router = useRouter();
  const nominaSlots = row.nominaSlots ?? [];
  const abonos = row.abonosDetail ?? [];
  const transferencias = row.transferenciasDetail ?? [];

  const [otrosIngresos, setOtrosIngresos] = useState(row.otrosIngresos ?? []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const otrosIngresosTotal = otrosIngresos.reduce((s, a) => s + a.amount, 0);
  const nominaTotal = row.ingresos_totales - otrosIngresosTotal + otrosIngresos.reduce((s, a) => s + a.amount, 0);

  async function addOtroIngreso() {
    const amount = parseFloat(newAmount);
    if (!newDesc.trim() || isNaN(amount) || amount <= 0) return;
    setSaving(true);
    const res = await fetch("/api/flow-adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: row.month, type: "income", description: newDesc.trim(), amount }),
    });
    if (res.ok) {
      const { adjustment } = await res.json();
      setOtrosIngresos((p) => [...p, adjustment]);
      setNewDesc("");
      setNewAmount("");
      setShowAddForm(false);
      router.refresh();
    }
    setSaving(false);
  }

  async function deleteOtroIngreso(id: string) {
    await fetch(`/api/flow-adjustments/${id}`, { method: "DELETE" });
    setOtrosIngresos((p) => p.filter((a) => a.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-1 pb-2">
      <SectionHeader label={isCurrent ? "Nómina pendiente" : "Nómina"} total={nominaTotal} />
      <Divider />

      {nominaSlots.length === 0 ? (
        <EmptyNote text="Sin fuentes de ingreso configuradas" />
      ) : (
        nominaSlots.map((src) => (
          <div key={src.sourceId} className="pt-2 pb-1">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-sm font-medium text-[var(--color-foreground)]">{src.sourceName}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted)]">
                {FREQ_LABELS[src.frequency] ?? src.frequency}
              </span>
            </div>

            {src.slots.length === 0 ? (
              <EmptyNote text="Sin pagos esperados este mes" />
            ) : (
              src.slots.map((slot, i) => {
                if (isCurrent) {
                  if (slot.confirmed) {
                    return (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                          <span className="text-sm text-[var(--color-muted)]">{formatDate(slot.date)}</span>
                          <span className="text-[10px] text-[var(--color-success)]">confirmado</span>
                        </div>
                        <span className="text-sm font-mono text-[var(--color-success)]">{formatMXN(slot.amount)}</span>
                      </div>
                    );
                  }
                  if (slot.isPast) {
                    return (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                        <div className="flex items-center gap-2">
                          <Circle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                          <span className="text-sm text-[var(--color-foreground)]">{formatDate(slot.date)}</span>
                          <span className="text-[10px] text-[var(--color-warning)]">pendiente ← suma aquí</span>
                        </div>
                        <span className="text-sm font-mono text-[var(--color-warning)]">{formatMXN(slot.amount)}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50 opacity-50">
                      <div className="flex items-center gap-2">
                        <Circle className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                        <span className="text-sm text-[var(--color-muted)]">{formatDate(slot.date)}</span>
                        <span className="text-[10px] text-[var(--color-muted)]">programado</span>
                      </div>
                      <span className="text-sm font-mono text-[var(--color-muted)]">{formatMXN(slot.amount)}</span>
                    </div>
                  );
                }

                if (isFuture) {
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                      <div className="flex items-center gap-2">
                        <Circle className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                        <span className="text-sm text-[var(--color-muted)]">{formatDate(slot.date)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted)]">
                          Proyectado
                        </span>
                      </div>
                      <span className="text-sm font-mono text-[var(--color-muted)]">{formatMXN(slot.amount)}</span>
                    </div>
                  );
                }

                // Past month: only confirmed entries appear as slots
                return slot.confirmed ? (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                      <span className="text-sm text-[var(--color-muted)]">{formatDate(slot.date)}</span>
                    </div>
                    <span className="text-sm font-mono text-[var(--color-success)]">{formatMXN(slot.amount)}</span>
                  </div>
                ) : null;
              })
            )}
          </div>
        ))
      )}

      {isCurrent && (
        <p className="text-[10px] text-[var(--color-muted)] pt-1">
          * Solo los pagos pendientes suman a Ingresos Totales
        </p>
      )}

      {/* Abonos — informativo */}
      {(row.abonos > 0 || abonos.length > 0 || (row.plannedTransfersInDetail ?? []).length > 0) && (
        <div className="pt-2">
          <SectionHeader label={isCurrent ? "Abonos · informativo" : "Abonos"} total={row.abonos} />
          {isCurrent && <p className="text-[10px] text-[var(--color-muted)] mb-1">No suman al total en mes actual</p>}
          <Divider />
          {abonos.map((a, i) => (
            <InfoRow
              key={i}
              label={a.merchant || a.accountName}
              value={formatMXN(a.amount)}
              sub={`${a.accountName} · ${formatDate(a.date)}`}
              valueClass="text-[var(--color-success)]"
            />
          ))}
          {(row.plannedTransfersInDetail ?? []).map((pt) => (
            <div key={pt.transferId} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft className="w-3 h-3 text-[var(--color-success)]" />
                <span className="text-sm text-[var(--color-foreground)]">{pt.name}</span>
                {pt.confirmed
                  ? <span className="text-[10px] text-[var(--color-success)]">confirmado</span>
                  : <span className="text-[10px] text-[var(--color-muted)] italic">proyectado</span>
                }
              </div>
              <span className={`text-sm font-mono ${pt.confirmed ? "text-[var(--color-success)]" : "text-[var(--color-muted)] italic"}`}>
                {formatMXN(pt.amount)}
              </span>
            </div>
          ))}
          {abonos.length === 0 && (row.plannedTransfersInDetail ?? []).length === 0 && (
            <EmptyNote text="Sin abonos este mes" />
          )}
        </div>
      )}

      {/* Otros ingresos */}
      <div className="pt-2">
        <SectionHeader label="Otros Ingresos" total={otrosIngresosTotal} />
        <Divider />
        {otrosIngresos.length === 0 && !showAddForm && (
          <EmptyNote text="Sin ingresos adicionales registrados" />
        )}
        {otrosIngresos.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/50">
            <span className="text-sm text-[var(--color-foreground)]">{a.description}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-[var(--color-success)]">{formatMXN(a.amount)}</span>
              <button
                onClick={() => deleteOtroIngreso(a.id)}
                className="text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors text-xs leading-none"
                aria-label="Eliminar"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {showAddForm && (
          <div className="flex items-center gap-2 py-2">
            <input
              type="text"
              placeholder="Descripción"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="flex-1 h-7 text-sm border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg)] text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addOtroIngreso(); if (e.key === "Escape") setShowAddForm(false); }}
              className="w-24 h-7 text-right text-sm font-mono border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg)] text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={addOtroIngreso}
              disabled={saving}
              className="h-7 px-2 text-xs rounded bg-[var(--color-success)] text-white disabled:opacity-50"
            >
              ✓
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewDesc(""); setNewAmount(""); }}
              className="h-7 px-2 text-xs rounded border border-[var(--color-border)] text-[var(--color-muted)]"
            >
              ✕
            </button>
          </div>
        )}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-1 text-xs text-[var(--color-success)] hover:underline"
          >
            + Agregar ingreso
          </button>
        )}
      </div>
    </div>
  );
}
