"use client";

import { useToast } from "@/components/kokonutui/promise-toast";
import SlideToConfirm from "@/components/kokonutui/slide-to-confirm";

export function DangerZone() {
  const { toast } = useToast();

  const handleReset = async () => {
    const res = await fetch("/api/settings/reset", { method: "POST" });
    if (!res.ok) throw new Error("Error al resetear");
    toast({ title: "Todos los datos han sido eliminados", status: "success" });
  };

  const handleSeed = async () => {
    const res = await fetch("/api/settings/seed", { method: "POST" });
    if (!res.ok) throw new Error("Error al cargar datos demo");
    toast({ title: "Datos de ejemplo cargados correctamente", status: "success" });
  };

  return (
    <div className="card-elevated p-6 space-y-5 border-[var(--color-danger)] border">
      <h2 className="text-base font-semibold text-[var(--color-danger)]">
        Zona peligrosa
      </h2>

      <div className="space-y-6">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-foreground)]">
              Resetear todos los datos
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Elimina todas las cuentas, transacciones, ingresos y preferencias. Esta acción no se puede deshacer.
            </p>
          </div>
          <SlideToConfirm
            label="Desliza para eliminar todo"
            confirmingLabel="Eliminando"
            doneLabel="Datos eliminados"
            onConfirm={handleReset}
            resetAfter={2000}
          />
        </div>

        <div className="border-t border-[var(--color-border)]" />

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-foreground)]">
              Cargar datos de ejemplo
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Reemplaza todos los datos actuales con datos de demostración (6 cuentas, transacciones y fuentes de ingreso).
            </p>
          </div>
          <SlideToConfirm
            label="Desliza para cargar datos demo"
            confirmingLabel="Cargando"
            doneLabel="Datos cargados"
            onConfirm={handleSeed}
            resetAfter={2000}
          />
        </div>
      </div>
    </div>
  );
}
