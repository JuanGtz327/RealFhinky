"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/kokonutui/promise-toast";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormActions } from "@/components/ui/form-actions";
import { z } from "zod";

const schema = z.object({
  account_id:  z.string().min(1, "Selecciona una cuenta"),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  merchant:    z.string().min(1, "Comercio requerido"),
  description: z.string().optional(),
  amount:      z.coerce.number().positive("El monto debe ser mayor a 0"),
  category:    z.string().optional(),
  type:        z.enum(["purchase", "income", "transfer_in", "transfer_out"]),
  is_msi:      z.boolean().optional(),
  msi_months:  z.coerce.number().int().min(2).max(60).optional(),
  notes:       z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Account { id: string; name: string; bank: string; type: string }

interface TransactionFormProps {
  accounts: Account[];
  initial?: Partial<FormData> & { id?: string };
  mode?: "create" | "edit";
  onSuccess?: () => void;
}

const NATIVE_SELECT = "select-field h-8 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-9 py-1 text-sm outline-none focus:ring-1 focus:ring-[var(--color-accent)] cursor-pointer";

const TX_TYPES_BY_ACCOUNT: Record<string, { value: string; label: string }[]> = {
  credit: [
    { value: "purchase",    label: "Compra / Cargo" },
    { value: "transfer_in", label: "Pago / Abono / Devolución" },
  ],
  loan: [
    { value: "purchase",    label: "Pago / Abono al préstamo" },
  ],
  debit: [
    { value: "income",       label: "Ingreso externo" },
    { value: "purchase",     label: "Gasto / Pago a tercero" },
    { value: "transfer_out", label: "Transferencia a cuenta propia" },
    { value: "transfer_in",  label: "Transferencia desde cuenta propia" },
  ],
  investment: [
    { value: "income",       label: "Ingreso / Rendimiento" },
    { value: "purchase",     label: "Retiro / Gasto" },
    { value: "transfer_out", label: "Transferencia a cuenta propia" },
    { value: "transfer_in",  label: "Transferencia desde cuenta propia" },
  ],
};

const CATEGORIES = [
  "Supermercado", "Restaurantes", "Transporte", "Entretenimiento",
  "Salud", "Educación", "Ropa", "Tecnología", "Servicios", "Viajes",
  "Delivery", "Compras", "Pagos", "Préstamo", "Efectivo", "Otros",
];

const MSI_OPTIONS = [3, 6, 9, 12, 18, 24];

export function TransactionForm({ accounts, initial, mode = "create", onSuccess }: TransactionFormProps) {
  const router = useRouter();
  const { toast, update } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Partial<FormData>>({
    type: "purchase",
    is_msi: false,
    date: new Date().toISOString().substring(0, 10),
    ...initial,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [customMsi, setCustomMsi] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === form.account_id);
  const isCredit  = selectedAccount?.type === "credit" || selectedAccount?.type === "loan";
  const isMsi     = form.is_msi && isCredit;

  const availableTypes = selectedAccount
    ? (TX_TYPES_BY_ACCOUNT[selectedAccount.type] ?? TX_TYPES_BY_ACCOUNT.debit)
    : TX_TYPES_BY_ACCOUNT.debit;

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  }

  const msiPreview = isMsi && form.amount && form.msi_months
    ? (() => {
        const base = Math.round(form.amount / form.msi_months * 100) / 100;
        const residual = Math.round((form.amount - base * form.msi_months) * 100) / 100;
        return { base, residual, last: base + residual };
      })()
    : null;

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
      const toastId = toast({ title: mode === "edit" ? "Guardando cambios…" : "Registrando transacción…", status: "loading" });
      try {
        const url    = mode === "edit" ? `/api/transactions/${initial?.id}` : "/api/transactions";
        const method = mode === "edit" ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Error al guardar"); }
        const { transaction } = await res.json();
        update(toastId, { title: mode === "edit" ? "Transacción actualizada" : "Transacción registrada", body: transaction.merchant ?? transaction.description ?? "", status: "success" });
        if (onSuccess) { router.refresh(); onSuccess(); }
        else { router.push("/transactions"); router.refresh(); }
      } catch (err) {
        update(toastId, { title: "Error al guardar", body: err instanceof Error ? err.message : "Error desconocido", status: "error" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Cuenta */}
      <FormField label="Cuenta" error={errors.account_id}>
        <select className={NATIVE_SELECT} value={form.account_id ?? ""}
          onChange={(e) => {
            const acc = accounts.find((a) => a.id === e.target.value);
            const defaultType = (acc?.type === "credit" || acc?.type === "loan") ? "purchase" : "income";
            set("account_id", e.target.value);
            set("type", defaultType);
            set("is_msi", false);
          }}>
          <option value="">Selecciona una cuenta…</option>
          {["credit","loan","debit","investment"].map((t) => {
            const group = accounts.filter((a) => a.type === t);
            if (group.length === 0) return null;
            const label = t === "credit" ? "Crédito" : t === "loan" ? "Préstamo" : t === "debit" ? "Débito" : "Inversión";
            return (
              <optgroup key={t} label={label}>
                {group.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} · {a.bank}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </FormField>

      {/* Fecha y tipo */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Fecha" error={errors.date}>
          <Input type="date" value={form.date ?? ""}
            onChange={(e) => set("date", e.target.value)} />
        </FormField>
        <FormField label="Tipo">
          <select className={NATIVE_SELECT} value={form.type ?? "purchase"}
            onChange={(e) => set("type", e.target.value as FormData["type"])}>
            {availableTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </FormField>
      </div>

      {/* Comercio y monto */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Comercio" error={errors.merchant}>
          <Input placeholder="Walmart, Netflix…" value={form.merchant ?? ""}
            onChange={(e) => set("merchant", e.target.value)} />
        </FormField>
        <FormField label="Monto (MXN)" error={errors.amount}>
          <Input type="number" step="0.01" placeholder="0.00"
            value={form.amount ?? ""}
            onChange={(e) => set("amount", parseFloat(e.target.value))} />
        </FormField>
      </div>

      {/* Categoría y descripción */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Categoría">
          <select className={NATIVE_SELECT} value={form.category ?? ""}
            onChange={(e) => set("category", e.target.value)}>
            <option value="">Sin categoría</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label="Descripción (opcional)">
          <Input placeholder="Notas adicionales…" value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)} />
        </FormField>
      </div>

      {/* MSI — solo crédito */}
      {isCredit && form.type === "purchase" && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_msi ?? false}
              onChange={(e) => set("is_msi", e.target.checked)}
              className="w-4 h-4 accent-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-foreground)]">Meses sin interés (MSI)</span>
          </label>

          {isMsi && (
            <>
              <FormField label="Número de meses">
                <div className="flex gap-2 flex-wrap items-center">
                  {MSI_OPTIONS.map((m) =>
                    (!customMsi && form.msi_months === m) ? (
                      <button key={m} type="button"
                        onClick={() => { setCustomMsi(false); set("msi_months", m); }}
                        className="px-3 py-1.5 rounded-md text-sm font-medium border transition-colors bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]">
                        {m}
                      </button>
                    ) : (
                      <button key={m} type="button"
                        onClick={() => { setCustomMsi(false); set("msi_months", m); }}
                        className="px-3 py-1.5 rounded-md text-sm font-medium border transition-colors border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50">
                        {m}
                      </button>
                    )
                  )}
                  {customMsi ? (
                    <button type="button"
                      onClick={() => { setCustomMsi(true); set("msi_months", undefined); }}
                      className="px-3 py-1.5 rounded-md text-sm font-medium border transition-colors bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]">
                      Otro
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => { setCustomMsi(true); set("msi_months", undefined); }}
                      className="px-3 py-1.5 rounded-md text-sm font-medium border transition-colors border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50">
                      Otro
                    </button>
                  )}
                </div>
                {customMsi && (
                  <Input
                    type="number"
                    min={2}
                    max={60}
                    placeholder="Ej: 15"
                    className="mt-2 h-8 w-32"
                    value={form.msi_months ?? ""}
                    onChange={(e) => set("msi_months", parseInt(e.target.value, 10) || undefined)}
                  />
                )}
              </FormField>

              {msiPreview && (
                <div className="rounded-md bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 p-3 text-sm space-y-1">
                  <p className="text-[var(--color-accent)] font-medium">Distribución automática</p>
                  <p className="text-[var(--color-foreground)]">
                    Meses 1–{form.msi_months! - 1}: <span className="font-mono">${msiPreview.base.toFixed(2)}/mes</span>
                  </p>
                  <p className="text-[var(--color-foreground)]">
                    Mes {form.msi_months} (último): <span className="font-mono">${msiPreview.last.toFixed(2)}</span>
                    {msiPreview.residual > 0 && (
                      <span className="text-[var(--color-muted)] ml-1">(+${msiPreview.residual.toFixed(2)} residual)</span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Notas */}
      <FormField label="Notas (opcional)">
        <Input placeholder="Notas…" value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)} />
      </FormField>

      <FormActions
        loading={pending}
        submitLabel={mode === "edit" ? "Guardar cambios" : "Registrar"}
        onCancel={() => onSuccess ? onSuccess() : router.back()}
      />
    </form>
  );
}
