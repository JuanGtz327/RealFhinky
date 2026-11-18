"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/ui/form-dialog";
import { RecurringChargeForm } from "@/components/subscriptions/RecurringChargeForm";
import { useToast } from "@/components/kokonutui/promise-toast";
import type { Account } from "@/lib/types";

interface NewRecurringChargeModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
}

export function NewRecurringChargeModal({ open, onClose, accounts }: NewRecurringChargeModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleSave = async (data: Parameters<typeof RecurringChargeForm>[0]["onSave"] extends (d: infer D) => unknown ? D : never) => {
    const res = await fetch("/api/recurring-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? "Error al crear cargo");
    }
    toast({ title: "Cargo creado", body: `${data.name} se ha registrado correctamente.`, status: "success" });
    router.refresh();
    onClose();
  };

  return (
    <FormDialog open={open} onClose={onClose} title="Nueva suscripción / cargo">
      <RecurringChargeForm accounts={accounts} onSave={handleSave} onCancel={onClose} />
    </FormDialog>
  );
}
