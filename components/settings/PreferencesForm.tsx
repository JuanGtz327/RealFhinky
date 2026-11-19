"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/kokonutui/promise-toast";
import { SectionTitle } from "@/components/ui/section-title";
import { usePreferences } from "@/lib/context/preferences";

export function PreferencesForm() {
  const { preferences: globalPrefs, updatePreferences, isLoading } = usePreferences();
  const [localPrefs, setLocalPrefs] = useState<Record<string, string> | null>(null);
  const { toast } = useToast();

  const prefs = localPrefs ?? globalPrefs;

  const handleChange = (key: string, value: string) => {
    setLocalPrefs((prev) => ({ ...(prev ?? globalPrefs), [key]: value }));
  };

  const handleSave = async () => {
    if (!localPrefs) return;
    try {
      await updatePreferences(localPrefs);
      setLocalPrefs(null);
      toast({ title: "Preferencias guardadas", status: "success" });
    } catch {
      toast({ title: "Error al guardar preferencias", status: "error" });
    }
  };

  const handleSwitchToggle = async (checked: boolean) => {
    const updated = { ...(localPrefs ?? globalPrefs), allow_early_confirmation: checked ? "true" : "false" };
    setLocalPrefs(updated);
    try {
      await updatePreferences(updated);
      setLocalPrefs(null);
      toast({ title: checked ? "Confirmación anticipada activada" : "Confirmación anticipada desactivada", status: "success" });
    } catch {
      toast({ title: "Error al guardar preferencia", status: "error" });
    }
  };

  if (isLoading) {
    return (
      <div className="card-elevated p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-[var(--color-border)]" />
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 space-y-5">
      <SectionTitle>Preferencias de UI</SectionTitle>

      <div className="space-y-5 max-w-lg">
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <select
            className="select-field h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-9 py-1 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            value={prefs.currency_code || "MXN"}
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
            className="select-field h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-9 py-1 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            value={prefs.date_locale || "es-MX"}
            onChange={(e) => handleChange("date_locale", e.target.value)}
          >
            <option value="es-MX">es-MX — 15 ene 2025</option>
            <option value="en-US">en-US — Jan 15, 2025</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>Tema</Label>
          <select
            className="select-field h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-2.5 pr-9 py-1 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            value={prefs.theme || "light"}
            onChange={(e) => handleChange("theme", e.target.value)}
          >
            <option value="light">Claro</option>
            <option value="dark" disabled>
              Oscuro (próximamente)
            </option>
          </select>
        </div>

        <div className="flex items-center justify-between py-3 px-1 border-t border-[var(--color-border)]">
          <div className="flex-1 mr-4">
            <Label>Confirmar antes de fecha</Label>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Permite confirmar ingresos, suscripciones y pagos antes de que llegue la fecha programada
            </p>
          </div>
          <Switch
            className="flex-shrink-0"
            checked={prefs.allow_early_confirmation === "true"}
            onCheckedChange={handleSwitchToggle}
          />
        </div>

        <div className="pt-2">
          <Button onClick={handleSave}>Guardar preferencias</Button>
        </div>
      </div>
    </div>
  );
}
