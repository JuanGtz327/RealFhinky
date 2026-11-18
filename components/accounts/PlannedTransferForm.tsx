"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { FormActions } from "@/components/ui/form-actions";
import type { PlannedTransfer } from "@/lib/types";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual",
  biweekly: "Quincenal",
  weekly: "Semanal",
  one_time: "Una vez",
  custom: "Personalizado",
};

const DIR_LABELS: Record<string, string> = {
  in: "Entrada (recibir dinero)",
  out: "Salida (enviar dinero)",
};

interface PlannedTransferFormData {
  name: string;
  account_id: string;
  direction: string;
  frequency: string;
  base_amount: number;
  is_variable: boolean;
  start_date: string;
  end_date?: string;
  custom_interval_days?: number;
  notes?: string;
}

interface PlannedTransferFormProps {
  accountId: string;
  initial?: PlannedTransfer;
  defaultDirection?: "in" | "out";
  onSave: (data: PlannedTransferFormData) => Promise<void>;
  onCancel: () => void;
}

export function PlannedTransferForm({ accountId, initial, defaultDirection, onSave, onCancel }: PlannedTransferFormProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState(initial?.name ?? "");
  const [direction, setDirection] = useState<"in" | "out">(initial?.direction ?? defaultDirection ?? "out");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly" | "custom" | "one_time">(initial?.frequency ?? "monthly");
  const [baseAmount, setBaseAmount] = useState(initial ? String(initial.base_amount) : "");
  const [isVariable, setIsVariable] = useState(initial?.is_variable ?? false);
  const [startDate, setStartDate] = useState(initial?.start_date ?? today);
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [customDays, setCustomDays] = useState(initial?.custom_interval_days ? String(initial.custom_interval_days) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(baseAmount);
    if (!name.trim()) { setError("Nombre es requerido"); return; }
    if (isNaN(amount) || amount <= 0) { setError("Monto inválido"); return; }
    if (!startDate) { setError("Fecha inicio es requerida"); return; }

    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        account_id: accountId,
        direction,
        frequency,
        base_amount: amount,
        is_variable: isVariable,
        start_date: startDate,
        end_date: endDate || undefined,
        custom_interval_days: frequency === "custom" && customDays ? parseInt(customDays) : undefined,
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
          placeholder="Renta, envío familiar..."
          className="h-8"
        />
      </FormField>

      <FormField label="Dirección">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "in" | "out")}
          className="select-field h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-9 py-1 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          {Object.entries(DIR_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Frecuencia">
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as "weekly" | "biweekly" | "monthly" | "custom" | "one_time")}
          className="select-field h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-9 py-1 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          {Object.entries(FREQ_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </FormField>

      {frequency === "custom" && (
        <FormField label="Intervalo (días)">
          <Input
            type="number"
            min="1"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            placeholder="14"
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
          id="pt_variable"
          checked={isVariable}
          onChange={(e) => setIsVariable(e.target.checked)}
          className="rounded border-[var(--color-border)] accent-[var(--color-accent)]"
        />
        <Label htmlFor="pt_variable" className="text-sm text-[var(--color-foreground)]">
          Monto variable
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

      <FormField label="Notas (opcional)">
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8"
        />
      </FormField>

      <FormActions
        submitLabel={initial ? "Guardar cambios" : "Crear transferencia"}
        loading={loading}
        onCancel={onCancel}
      />
    </form>
  );
}
