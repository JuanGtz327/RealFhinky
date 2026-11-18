"use client";

import { AlertTriangle } from "lucide-react";

interface ChargeOverdueBannerProps {
  overdueCount: number;
}

export function ChargeOverdueBanner({ overdueCount }: ChargeOverdueBannerProps) {
  if (overdueCount <= 0) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3 animate-in slide-in-from-top-3 duration-500"
      style={{ background: "var(--color-navbar)", borderLeft: "4px solid var(--color-accent)" }}
    >
      <div className="flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.5 badge-accent-pill">
        <AlertTriangle className="w-3.5 h-3.5 animate-pulse" style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>
          Pendiente
        </span>
      </div>
      <p className="text-sm text-white/80">
        Tienes{" "}
        <span className="font-bold text-white">
          {overdueCount} {overdueCount === 1 ? "cargo recurrente pendiente" : "cargos recurrentes pendientes"}
        </span>{" "}
        de confirmar este mes.
      </p>
    </div>
  );
}
