"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { FormActions } from "@/components/ui/form-actions";
import type { RecurringCharge, Account } from "@/lib/types";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  custom: "Personalizado",
};

interface RecurringChargeFormData {
  name: string;
  account_id: string;
  frequency: string;
  base_amount: number;
  is_variable: boolean;
  start_date: string;
  end_date?: string;
  custom_interval_months?: number;
  category?: string;
  notes?: string;
}

interface RecurringChargeFormProps {
  accounts: Account[];
  initial?: RecurringCharge;
  onSave: (data: RecurringChargeFormData) => Promise<void>;
  onCancel: () => void;
}

export function RecurringChargeForm({ accounts, initial, onSave, onCancel }: RecurringChargeFormProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState(initial?.name ?? "");
  const [accountId, setAccountId] = useState(initial?.account_id ?? (accounts[0]?.id ?? ""));
  const [frequency, setFrequency] = useState<"monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual" | "custom">(initial?.frequency ?? "monthly");
  const [baseAmount, setBaseAmount] = useState(initial ? String(initial.base_amount) : "");
  const [isVariable, setIsVariable] = useState(initial?.is_variable ?? false);
  const [startDate, setStartDate] = useState(initial?.start_date ?? today);
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [customMonths, setCustomMonths] = useState(initial?.custom_interval_months ? String(initial.custom_interval_months) : "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(baseAmount);
    if (!name.trim()) { setError("Nombre es requerido"); return; }
    if (!accountId) { setError("Cuenta es requerida"); return; }
    if (isNaN(amount) || amount <= 0) { setError("Monto inválido"); return; }
    if (!startDate) { setError("Fecha inicio es requerida"); return; }

    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        account_id: accountId,
        frequency,
        base_amount: amount,
        is_variable: isVariable,
        start_date: startDate,
        end_date: endDate || undefined,
        custom_interval_months: frequency === "custom" && customMonths ? parseInt(customMonths) : undefined,
        category: category.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <FormField label="Nombre" error={error ?? undefined}>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Netflix, CFE, Spotify..."
          className="h-8"
        />
      </FormField>

      <FormField label="Cuenta">
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="select-field h-8 pl-2.5 pr-9 py-1 w-full"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} — {a.bank}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Frecuencia">
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual" | "custom")}
          className="select-field h-8 pl-2.5 pr-9 py-1 w-full"
        >
          {Object.entries(FREQ_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </FormField>

      {frequency === "custom" && (
        <FormField label="Intervalo (meses)">
          <Input
            type="number"
            min="1"
            value={customMonths}
            onChange={(e) => setCustomMonths(e.target.value)}
            placeholder="2"
            className="h-8"
          />
        </FormField>
      )}

      <FormField label="Monto base">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)] pointer-events-none">$</span>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={baseAmount}
            onChange={(e) => setBaseAmount(e.target.value)}
            className="h-8 pl-6"
          />
        </div>
      </FormField>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_variable"
          checked={isVariable}
          onChange={(e) => setIsVariable(e.target.checked)}
          className="rounded border-[var(--color-border)] accent-[var(--color-accent)]"
        />
        <Label htmlFor="is_variable" className="text-sm text-[var(--color-foreground)]">
          Monto variable (puede cambiar cada mes)
        </Label>
      </div>

      <FormField label="Fecha inicio">
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-8"
        />
      </FormField>

      <FormField label="Fecha fin (opcional)">
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-8"
        />
      </FormField>

      <FormField label="Categoría (opcional)">
        <Input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Entretenimiento, Servicios..."
          className="h-8"
        />
      </FormField>

      <FormField label="Notas (opcional)">
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8"
        />
      </FormField>

      <FormActions
        submitLabel={initial ? "Guardar cambios" : "Crear cargo"}
        loading={loading}
        onCancel={onCancel}
      />
    </form>
  );
}
