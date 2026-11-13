"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/kokonutui/promise-toast";
import SlideToConfirm from "@/components/kokonutui/slide-to-confirm";

interface DeleteSlideProps {
  id: string;
  type: "account" | "transaction";
  label?: string;
}

export function DeleteSlide({ id, type, label }: DeleteSlideProps) {
  const router = useRouter();
  const { toast, update } = useToast();

  async function handleConfirm() {
    const toastId = toast({ title: `Eliminando ${type === "account" ? "cuenta" : "transacción"}…`, status: "loading" });
    try {
      const url = type === "account" ? `/api/accounts/${id}` : `/api/transactions/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      update(toastId, {
        title: type === "account" ? "Cuenta eliminada" : "Transacción eliminada",
        status: "success",
      });
      router.push(type === "account" ? "/accounts" : "/transactions");
      router.refresh();
    } catch (err) {
      update(toastId, {
        title: "Error al eliminar",
        body: err instanceof Error ? err.message : "Error desconocido",
        status: "error",
      });
    }
  }

  return (
    <SlideToConfirm
      label={label ?? `Desliza para eliminar`}
      confirmingLabel="Eliminando…"
      doneLabel="Eliminado"
      onConfirm={handleConfirm}
    />
  );
}
