"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/kokonutui/promise-toast";
import { formatMXN } from "@/lib/utils/formatters";
import { msiElapsed, msiRemainingAmount, roundCents } from "@/lib/utils/msi";

interface MsiPlan {
  merchant:   string;
  amount:     number | "";
  msi_months: number;
  start_date: string;
}

interface Props {
  accountId:      string;
  accountName:    string;
  currentBalance: number;
  cutDay?:        number;
}

const MSI_OPTIONS = [3, 6, 9, 12, 18, 24];

export function OpeningBalanceWizard({ accountId, accountName, currentBalance, cutDay }: Props) {
  const router = useRouter();
  const { toast, update } = useToast();
  const [open, setOpen]       = useState(false);
  const [purchases, setPurchases] = useState<number | "">("");
  const [carryover, setCarryover] = useState<number | "">("");
  const [plans, setPlans]     = useState<MsiPlan[]>([]);
  const [saving, setSaving]   = useState(false);
  const [customMsiSet, setCustomMsiSet] = useState<Set<number>>(new Set());

  const totalMsi      = plans.reduce((s, p) => s + msiRemainingAmount(Number(p.amount), p.msi_months, p.start_date, cutDay), 0);
  const totalAssigned = (Number(purchases) || 0) + (Number(carryover) || 0) + totalMsi;
  const diff          = currentBalance - totalAssigned;
  const diffOk        = Math.abs(diff) < 0.01;

  function addPlan() {
    setPlans((p) => [...p, {
      merchant:   "",
      amount:     "",
      msi_months: 12,
      start_date: new Date().toISOString().substring(0, 10),
    }]);
  }

  function removePlan(i: number) {
    setPlans((p) => p.filter((_, idx) => idx !== i));
    setCustomMsiSet((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      }
      return next;
    });
  }

  function setCustomMsi(i: number, custom: boolean) {
    setCustomMsiSet((prev) => {
      const next = new Set(prev);
      if (custom) next.add(i); else next.delete(i);
      return next;
    });
  }

  function updatePlan<K extends keyof MsiPlan>(i: number, key: K, val: MsiPlan[K]) {
    setPlans((p) => p.map((plan, idx) => idx === i ? { ...plan, [key]: val } : plan));
  }

  async function handleSave() {
    setSaving(true);
    const toastId = toast({ title: "Configurando saldo inicial…", status: "loading" });
    try {
      const res = await fetch("/api/accounts/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          purchases:  Number(purchases) || 0,
          carryover:  Number(carryover) || 0,
          msi_plans:  plans.map((p) => ({
            merchant:   p.merchant,
            amount:     Number(p.amount),
            msi_months: p.msi_months,
            start_date: p.start_date,
          })),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      update(toastId, { title: "Saldo inicial configurado", status: "success" });
      router.refresh();
    } catch (err) {
      update(toastId, { title: "Error al guardar", body: err instanceof Error ? err.message : "", status: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-elevated border-dashed border-2 p-5 space-y-4">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            Configurar saldo inicial
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            {accountName} tiene {formatMXN(currentBalance)} de deuda sin transacciones registradas.
            Dinos de qué está compuesto para proyectar correctamente.
          </p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
        }
      </button>

      {open && (
        <div className="space-y-6 pt-2">

          {/* Sección 1: Compras del mes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-xs font-bold">1</span>
              <h3 className="text-sm font-medium text-[var(--color-foreground)]">Compras normales de este mes</h3>
            </div>
            <p className="text-xs text-[var(--color-muted)] pl-7">
              Gastos a contado (supermercado, gasolina, restaurantes…) hechos en el ciclo actual.
            </p>
            <div className="pl-7">
              <FormField label="Monto">
                <Input
                  type="number" step="0.01" placeholder="0.00"
                  value={purchases}
                  onChange={(e) => setPurchases(e.target.value === "" ? "" : parseFloat(e.target.value))}
                />
              </FormField>
            </div>
          </div>

          {/* Sección 2: MSI activos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-xs font-bold">2</span>
                <h3 className="text-sm font-medium text-[var(--color-foreground)]">Planes MSI activos</h3>
              </div>
              <Button type="button" variant="outline" onClick={addPlan} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Agregar
              </Button>
            </div>
            <p className="text-xs text-[var(--color-muted)] pl-7">
              Compras a meses sin interés. El sistema generará las cuotas restantes automáticamente.
            </p>

            {plans.length === 0 && (
              <p className="pl-7 text-xs text-[var(--color-muted)] italic">Sin planes MSI registrados.</p>
            )}

            {plans.map((plan, i) => (
              <div key={i} className="pl-7 rounded-lg border border-[var(--color-border)] p-4 space-y-3 bg-[var(--color-bg)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--color-muted)]">Plan MSI #{i + 1}</span>
                  <button type="button" onClick={() => removePlan(i)}
                    className="text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Artículo / Comercio">
                    <Input placeholder="MacBook, Samsung…"
                      value={plan.merchant}
                      onChange={(e) => updatePlan(i, "merchant", e.target.value)} />
                  </FormField>
                  <FormField label="Monto total original">
                    <Input type="number" step="0.01" placeholder="0.00"
                      value={plan.amount}
                      onChange={(e) => updatePlan(i, "amount", e.target.value === "" ? "" : parseFloat(e.target.value))} />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Fecha de compra">
                    <Input type="date" value={plan.start_date}
                      onChange={(e) => updatePlan(i, "start_date", e.target.value)} />
                  </FormField>
                  <FormField label="Total de meses">
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {MSI_OPTIONS.map((m) =>
                        (!customMsiSet.has(i) && plan.msi_months === m) ? (
                          <button key={m} type="button"
                            onClick={() => { setCustomMsi(i, false); updatePlan(i, "msi_months", m); }}
                            className="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]">
                            {m}
                          </button>
                        ) : (
                          <button key={m} type="button"
                            onClick={() => { setCustomMsi(i, false); updatePlan(i, "msi_months", m); }}
                            className="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50">
                            {m}
                          </button>
                        )
                      )}
                      {customMsiSet.has(i) ? (
                        <button type="button"
                          onClick={() => setCustomMsi(i, true)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]">
                          Otro
                        </button>
                      ) : (
                        <button type="button"
                          onClick={() => setCustomMsi(i, true)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50">
                          Otro
                        </button>
                      )}
                    </div>
                    {customMsiSet.has(i) && (
                      <Input
                        type="number"
                        min={2}
                        max={60}
                        placeholder="Ej: 15"
                        className="mt-2 h-8 w-32"
                        value={plan.msi_months || ""}
                        onChange={(e) => updatePlan(i, "msi_months", parseInt(e.target.value, 10) || 0)}
                      />
                    )}
                  </FormField>
                </div>

                {plan.amount && plan.msi_months && (() => {
                  const remaining = msiRemainingAmount(Number(plan.amount), plan.msi_months, plan.start_date);
                  const base = roundCents(Number(plan.amount) / plan.msi_months);
                  const remainingMonths = Math.max(0, plan.msi_months - msiElapsed(plan.start_date, cutDay));
                  return (
                    <p className="text-xs text-[var(--color-accent)]">
                      ~{formatMXN(base)}/mes × {remainingMonths} meses restantes
                      {" "}<span className="text-[var(--color-muted)]">= {formatMXN(remaining)} en saldo</span>
                    </p>
                  );
                })()}
              </div>
            ))}
          </div>

          {/* Sección 3: Arrastre */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-xs font-bold">3</span>
              <h3 className="text-sm font-medium text-[var(--color-foreground)]">Arrastre de meses anteriores</h3>
            </div>
            <p className="text-xs text-[var(--color-muted)] pl-7">
              Deuda de periodos anteriores que no pagas en su totalidad. Se registra en el saldo pero
              no se proyecta en el flujo futuro (ya es deuda existente).
            </p>
            <div className="pl-7">
              <FormField label="Monto">
                <Input
                  type="number" step="0.01" placeholder="0.00"
                  value={carryover}
                  onChange={(e) => setCarryover(e.target.value === "" ? "" : parseFloat(e.target.value))}
                />
              </FormField>
            </div>
          </div>

          {/* Totalizador */}
          <div className={`rounded-lg p-3 text-sm border ${diffOk ? "bg-[var(--color-success)]/10 border-[var(--color-success)]/30" : "bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30"}`}>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Saldo de la tarjeta</span>
              <span className="font-mono font-medium">{formatMXN(currentBalance)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[var(--color-muted)]">Total asignado</span>
              <span className="font-mono font-medium">{formatMXN(totalAssigned)}</span>
            </div>
            {!diffOk && (
              <div className="flex items-center justify-between mt-1 font-medium">
                <span className="text-[var(--color-warning)]">
                  {diff > 0 ? "Sin asignar" : "Excede el saldo"}
                </span>
                <span className="font-mono text-[var(--color-warning)]">{formatMXN(Math.abs(diff))}</span>
              </div>
            )}
            {diffOk && (
              <p className="mt-1 text-[var(--color-success)] font-medium">✓ Saldo completamente asignado</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar saldo inicial"}
            </Button>
          </div>

        </div>
      )}
    </div>
  );
}
