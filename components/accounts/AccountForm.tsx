"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/kokonutui/promise-toast";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormActions } from "@/components/ui/form-actions";
import { z } from "zod";

const schema = z.object({
  name:             z.string().min(1, "Nombre requerido"),
  type:             z.enum(["credit", "debit", "loan", "investment"]),
  bank:             z.string().min(1, "Banco requerido"),
  last4:            z.string().length(4).optional().or(z.literal("")),
  credit_limit:     z.coerce.number().min(0).optional(),
  current_balance:  z.coerce.number().optional(),
  yield_rate:       z.coerce.number().min(0).max(100).optional(),
  cut_date:         z.coerce.number().int().min(1).max(31).optional(),
  payment_due_date: z.coerce.number().int().min(1).max(31).optional(),
  annual_fee:       z.coerce.number().min(0).optional(),
  annual_fee_date:  z.string().optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

interface AccountFormProps {
  initial?: Partial<FormData> & { id?: string };
  mode: "create" | "edit";
  onSuccess?: () => void;
}

export function AccountForm({ initial, mode, onSuccess }: AccountFormProps) {
  const router  = useRouter();
  const { toast, update } = useToast();
  const [form, setForm] = useState<Partial<FormData>>({
    type: "credit",
    current_balance: 0,
    ...initial,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);

  const type = form.type ?? "credit";
  const isCredit  = type === "credit" || type === "loan";
  const isDebit   = type === "debit" || type === "investment";

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
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

    setLoading(true);
    const toastId = toast({ title: mode === "edit" ? "Guardando cambios…" : "Creando cuenta…", status: "loading" });
    try {
      const url    = mode === "edit" ? `/api/accounts/${initial?.id}` : "/api/accounts";
      const method = mode === "edit" ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!res.ok) throw new Error(await res.text());
      const { account } = await res.json();
      update(toastId, { title: mode === "edit" ? "Cuenta actualizada" : "Cuenta creada", body: account.name, status: "success" });
      if (onSuccess) { router.refresh(); onSuccess(); }
      else { router.push(`/accounts/${account.id}`); router.refresh(); }
    } catch (err) {
      update(toastId, { title: "Error al guardar", body: err instanceof Error ? err.message : "Error desconocido", status: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Tipo */}
      <FormField label="Tipo de cuenta">
        <div className="grid grid-cols-4 gap-2">
          {(["credit","debit","loan","investment"] as const).map((t) => (
            <button key={t} type="button"
              onClick={() => set("type", t)}
              className={`py-2 rounded-md text-xs font-medium border transition-colors ${
                form.type === t
                  ? "bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50"
              }`}
            >
              {t === "credit" ? "Crédito" : t === "debit" ? "Débito" : t === "loan" ? "Préstamo" : "Inversión"}
            </button>
          ))}
        </div>
      </FormField>

      {/* Nombre y Banco */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombre" error={errors.name}>
          <Input placeholder="BBVA Azul" value={form.name ?? ""}
            onChange={(e) => set("name", e.target.value)} />
        </FormField>
        <FormField label="Banco" error={errors.bank}>
          <Input placeholder="BBVA" value={form.bank ?? ""}
            onChange={(e) => set("bank", e.target.value)} />
        </FormField>
      </div>

      {/* Últimos 4 y saldo */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Últimos 4 dígitos">
          <Input placeholder="1234" maxLength={4} value={form.last4 ?? ""}
            onChange={(e) => set("last4", e.target.value)} />
        </FormField>
        <FormField label={isCredit ? "Saldo actual (deuda)" : "Saldo actual"}>
          <Input type="number" step="0.01" placeholder="0.00"
            value={form.current_balance ?? ""}
            onChange={(e) => set("current_balance", parseFloat(e.target.value))} />
        </FormField>
      </div>

      {/* Crédito/Préstamo */}
      {isCredit && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Línea de crédito">
              <Input type="number" step="0.01" placeholder="50000"
                value={form.credit_limit ?? ""}
                onChange={(e) => set("credit_limit", parseFloat(e.target.value))} />
            </FormField>
            <FormField label="Anualidad ($)">
              <Input type="number" step="0.01" placeholder="0"
                value={form.annual_fee ?? ""}
                onChange={(e) => set("annual_fee", parseFloat(e.target.value))} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Día de corte">
              <Input type="number" min={1} max={31} placeholder="12"
                value={form.cut_date ?? ""}
                onChange={(e) => set("cut_date", parseInt(e.target.value))} />
            </FormField>
            <FormField label="Día límite de pago">
              <Input type="number" min={1} max={31} placeholder="7"
                value={form.payment_due_date ?? ""}
                onChange={(e) => set("payment_due_date", parseInt(e.target.value))} />
            </FormField>
            <FormField label="Fecha cobro anualidad">
              <Input type="date" value={form.annual_fee_date ?? ""}
                onChange={(e) => set("annual_fee_date", e.target.value)} />
            </FormField>
          </div>
        </>
      )}

      {/* Débito/Inversión */}
      {isDebit && (
        <FormField label="Tasa de rendimiento anual (%)">
          <Input type="number" step="0.01" placeholder="4.5"
            value={form.yield_rate ?? ""}
            onChange={(e) => set("yield_rate", parseFloat(e.target.value))} />
        </FormField>
      )}

      <FormActions
        loading={loading}
        submitLabel={mode === "edit" ? "Guardar cambios" : "Crear cuenta"}
        onCancel={() => onSuccess ? onSuccess() : router.back()}
      />
    </form>
  );
}
