"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/ui/form-dialog";
import { RecurringChargeForm } from "@/components/subscriptions/RecurringChargeForm";
import { useToast } from "@/components/kokonutui/promise-toast";
import type { Account, RecurringCharge } from "@/lib/types";

interface NewRecurringChargeModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  initial?: RecurringCharge;
}

export function NewRecurringChargeModal({ open, onClose, accounts, initial }: NewRecurringChargeModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!initial;

  const handleSave = async (data: Parameters<typeof RecurringChargeForm>[0]["onSave"] extends (d: infer D) => unknown ? D : never) => {
    const url = isEdit ? `/api/recurring-charges/${initial!.id}` : "/api/recurring-charges";
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? "Error al guardar cargo");
    }
    toast({
      title: isEdit ? "Cargo actualizado" : "Cargo creado",
      body: `${data.name} se ha guardado correctamente.`,
      status: "success",
    });
    router.refresh();
    onClose();
  };

  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? "Editar suscripción" : "Nueva suscripción / cargo"}>
      <RecurringChargeForm accounts={accounts} initial={initial} onSave={handleSave} onCancel={onClose} />
    </FormDialog>
  );
}
