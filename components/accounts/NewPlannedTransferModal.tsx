"use client";

import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/ui/form-dialog";
import { PlannedTransferForm } from "@/components/accounts/PlannedTransferForm";
import { useToast } from "@/components/kokonutui/promise-toast";

interface NewPlannedTransferModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
}

export function NewPlannedTransferModal({ open, onClose, accountId }: NewPlannedTransferModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleSave = async (data: Parameters<typeof PlannedTransferForm>[0]["onSave"] extends (d: infer D) => unknown ? D : never) => {
    const res = await fetch("/api/planned-transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? "Error al crear transferencia");
    }
    toast({ title: "Transferencia creada", body: `${data.name} se ha registrado correctamente.`, status: "success" });
    router.refresh();
    onClose();
  };

  return (
    <FormDialog open={open} onClose={onClose} title="Nueva transferencia planificada">
      <PlannedTransferForm accountId={accountId} onSave={handleSave} onCancel={onClose} />
    </FormDialog>
  );
}
