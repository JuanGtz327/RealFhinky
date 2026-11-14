"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/kokonutui/promise-toast";

export function PreferencesForm() {
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings/preferences")
      .then((r) => r.json())
      .then((d) => setPreferences(d.preferences))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Preferencias guardadas", status: "success" });
    } catch {
      toast({ title: "Error al guardar preferencias", status: "error" });
    }
  };

  if (loading) {
    return (
      <div className="card-elevated p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-[var(--color-border)]" />
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 space-y-5">
      <h2 className="text-base font-semibold text-[var(--color-navbar)]">
        Preferencias de UI
      </h2>

      <div className="space-y-5 max-w-lg">
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <select
            className="select-field h-8 pl-2.5 pr-9 py-1"
            value={preferences.currency_code || "MXN"}
            onChange={(e) => {
              handleChange("currency_code", e.target.value);
              const localeMap: Record<string, string> = {
                MXN: "es-MX",
                USD: "en-US",
                EUR: "de-DE",
              };
              handleChange("currency_locale", localeMap[e.target.value] || "es-MX");
            }}
          >
            <option value="MXN">MXN — Peso Mexicano</option>
            <option value="USD">USD — Dólar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Formato de fecha</Label>
          <select
            className="select-field h-8 pl-2.5 pr-9 py-1"
            value={preferences.date_locale || "es-MX"}
            onChange={(e) => handleChange("date_locale", e.target.value)}
          >
            <option value="es-MX">es-MX — 15 ene 2025</option>
            <option value="en-US">en-US — Jan 15, 2025</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Tema</Label>
          <select
            className="select-field h-8 pl-2.5 pr-9 py-1"
            value={preferences.theme || "light"}
            onChange={(e) => handleChange("theme", e.target.value)}
          >
            <option value="light">Claro</option>
            <option value="dark" disabled>
              Oscuro (próximamente)
            </option>
          </select>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave}>Guardar preferencias</Button>
        </div>
      </div>
    </div>
  );
}
