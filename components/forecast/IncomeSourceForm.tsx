"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/kokonutui/promise-toast";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormActions } from "@/components/ui/form-actions";
import { z } from "zod";

const schema = z.object({
  name:                 z.string().min(1, "Nombre requerido"),
  frequency:            z.enum(["weekly", "biweekly", "monthly", "custom"]),
  base_amount:          z.coerce.number().min(0, "Monto requerido"),
  is_variable:          z.boolean().optional(),
  start_date:           z.string().optional(),
  custom_interval_days: z.coerce.number().int().min(1).optional(),
  account_id:           z.string().optional().nullable(),
}).refine(
  (d) => d.frequency !== "custom" || (d.custom_interval_days != null && d.custom_interval_days >= 1),
  { message: "Especifica cada cuántos días se repite", path: ["custom_interval_days"] }
);

type FormData = z.infer<typeof schema>;

interface DebitAccountOption {
  id: string;
  name: string;
  bank: string;
}

interface IncomeSourceFormProps {
  initial?: Partial<FormData> & { id?: string };
  mode?: "create" | "edit";
  onSuccess?: () => void;
  debitAccounts?: DebitAccountOption[];
}

const FREQ_LABELS = { weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado" };

export function IncomeSourceForm({ initial, mode = "create", onSuccess, debitAccounts = [] }: IncomeSourceFormProps) {
  const router = useRouter();
  const { toast, update } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Partial<FormData>>({
    frequency:   "biweekly",
    is_variable: false,
    ...initial,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const preview = form.base_amount
    ? (() => {
        const amt = form.base_amount;
        switch (form.frequency) {
          case "weekly":    return { label: "~4 pagos/mes", monthly: amt * 4 };
          case "biweekly":  return { label: "2 pagos/mes",  monthly: amt * 2 };
          case "monthly":   return { label: "1 pago/mes",   monthly: amt };
          case "custom": {
            const days = form.custom_interval_days;
            if (!days) return { label: "personalizado", monthly: amt };
            const times = Math.round(30 / days);
            return { label: `~${times}x / mes (cada ${days} días)`, monthly: amt * times };
          }
          default:          return null;
        }
      })()
    : null;

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: typeof errors = {};
      for (const [k, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
        errs[k as keyof FormData] = (msgs as string[])[0];
      }
      setErrors(errs);
      return;
    }
    startTransition(async () => {
      const toastId = toast({ title: "Guardando fuente de ingreso…", status: "loading" });
      try {
        const url    = mode === "edit" ? `/api/income/sources` : "/api/income/sources";
        const method = mode === "edit" ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
        if (!res.ok) throw new Error(await res.text());
        const { source } = await res.json();
        update(toastId, { title: "Fuente de ingreso guardada", body: source?.name ?? "", status: "success" });
        if (onSuccess) { router.refresh(); onSuccess(); }
        else { router.push("/forecast"); router.refresh(); }
      } catch (err) {
        update(toastId, { title: "Error al guardar", body: err instanceof Error ? err.message : "Error", status: "error" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <FormField label="Nombre de la fuente" error={errors.name}>
        <Input placeholder="Nómina principal, Freelance…" value={form.name ?? ""}
          onChange={(e) => set("name", e.target.value)} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Frecuencia">
          <div className="grid grid-cols-2 gap-1.5">
            {(["weekly","biweekly","monthly","custom"] as const).map((f) => (
              <button key={f} type="button" onClick={() => set("frequency", f)}
                className={`py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  form.frequency === f
                    ? "bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50"
                }`}>
                {FREQ_LABELS[f]}
              </button>
            ))}
          </div>
          {form.frequency === "custom" && (
            <FormField label="Cada cuántos días" error={errors.custom_interval_days} className="mt-3">
              <Input
                type="number"
                min={1}
                step={1}
                placeholder="ej. 7, 14, 30"
                value={form.custom_interval_days ?? ""}
                onChange={(e) => set("custom_interval_days", parseInt(e.target.value) || undefined as unknown as number)}
              />
            </FormField>
          )}
        </FormField>

        <div className="space-y-3">
          <FormField label="Monto por pago (MXN)" error={errors.base_amount}>
            <Input type="number" step="0.01" placeholder="0.00"
              value={form.base_amount ?? ""}
              onChange={(e) => set("base_amount", parseFloat(e.target.value))} />
          </FormField>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_variable ?? false}
              onChange={(e) => set("is_variable", e.target.checked)}
              className="w-4 h-4 accent-[var(--color-accent)]" />
            <span className="text-xs text-[var(--color-muted)]">Monto variable</span>
          </label>
        </div>
      </div>

      <FormField label="Fecha de inicio">
        <Input type="date" value={form.start_date ?? ""}
          onChange={(e) => set("start_date", e.target.value)} />
      </FormField>

      {debitAccounts.length > 0 && (
        <FormField label="Cuenta donde se deposita (opcional)">
          <select
            className="select-field h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-9 py-1 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            value={form.account_id ?? ""}
            onChange={(e) => set("account_id", e.target.value || null)}
          >
            <option value="">— Ninguna / no especificada</option>
            {debitAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · {a.bank}</option>
            ))}
          </select>
        </FormField>
      )}

      {preview && (
        <div className="rounded-md bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 p-3 text-sm">
          <p className="text-[var(--color-accent)] font-medium mb-1">Proyección mensual estimada</p>
          <p className="text-[var(--color-foreground)] font-mono">
            ${preview.monthly.toLocaleString("es-MX", { minimumFractionDigits: 2 })} / mes
            <span className="text-[var(--color-muted)] ml-2 text-xs">({preview.label})</span>
          </p>
          {form.is_variable && (
            <p className="text-xs text-[var(--color-muted)] mt-1">
              * Marcado como variable — podrás registrar el monto real cada quincena
            </p>
          )}
        </div>
      )}

      <FormActions
        loading={pending}
        submitLabel={mode === "edit" ? "Guardar cambios" : "Agregar fuente"}
        onCancel={() => onSuccess ? onSuccess() : router.back()}
      />
    </form>
  );
}
