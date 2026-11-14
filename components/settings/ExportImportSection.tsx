"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/kokonutui/promise-toast";
import { Download, Upload } from "lucide-react";

export function ExportImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      const res = await fetch("/api/settings/export");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finkhy-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Datos exportados", status: "success" });
    } catch {
      toast({ title: "Error al exportar datos", status: "error" });
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al importar");
      }
      toast({ title: "Datos importados correctamente", status: "success" });
    } catch {
      toast({ title: "Error al importar datos", status: "error" });
    }
  };

  return (
    <div className="card-elevated p-6 space-y-3">
      <h2 className="text-base font-semibold text-[var(--color-navbar)]">
        Exportar / Importar datos
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-lift p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-[var(--color-accent)]" />
            <h3 className="text-sm font-medium text-[var(--color-foreground)]">
              Exportar
            </h3>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Descarga un archivo JSON con todas tus cuentas, transacciones e ingresos.
          </p>
          <Button variant="outline" onClick={handleExport}>
            Descargar JSON
          </Button>
        </div>

        <div className="card-lift p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-[var(--color-accent)]" />
            <h3 className="text-sm font-medium text-[var(--color-foreground)]">
              Importar
            </h3>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Restaura tus datos desde un archivo JSON previamente exportado. Esto reemplaza todos los datos actuales.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Restaurar desde archivo
          </Button>
        </div>
      </div>
    </div>
  );
}
