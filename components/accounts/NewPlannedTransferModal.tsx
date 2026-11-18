"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { FormDialog } from "@/components/ui/form-dialog";
import { PlannedTransferForm } from "@/components/accounts/PlannedTransferForm";
import { useToast } from "@/components/kokonutui/promise-toast";
import type { PlannedTransfer } from "@/lib/types";

interface NewPlannedTransferModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  defaultDirection?: "in" | "out";
  initial?: PlannedTransfer;
}

export function NewPlannedTransferModal({ open, onClose, accountId, defaultDirection, initial }: NewPlannedTransferModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!initial;

  const handleSave = async (data: Parameters<typeof PlannedTransferForm>[0]["onSave"] extends (d: infer D) => unknown ? D : never) => {
    const url = isEdit ? `/api/planned-transfers/${initial!.id}` : "/api/planned-transfers";
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? "Error al guardar transferencia");
    }
    toast({
      title: isEdit ? "Transferencia actualizada" : "Transferencia creada",
      body: `${data.name} se ha guardado correctamente.`,
      status: "success",
    });
    router.refresh();
    onClose();
  };

  const dir = initial?.direction ?? defaultDirection;
  const title = isEdit
    ? (dir === "in" ? "Editar abono planificado" : "Editar salida planificada")
    : (dir === "in" ? "Nuevo abono planificado" : "Nueva salida planificada");

  return (
    <FormDialog open={open} onClose={onClose} title={title} icon={<ArrowUpDown className="w-4 h-4" />}>
      <PlannedTransferForm accountId={accountId} initial={initial} defaultDirection={defaultDirection} onSave={handleSave} onCancel={onClose} />
    </FormDialog>
  );
}
