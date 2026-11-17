"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmPaymentButtonProps {
  onClick: () => void;
  label?: string;
  /** "normal" = ciclo cerrado sin urgencia, "warning" = pago próximo, "danger" = vencido */
  urgency?: "normal" | "warning" | "danger";
  /** "dark" = sobre fondo oscuro (navbar/charcoal), "light" = sobre fondo claro */
  variant?: "dark" | "light";
  className?: string;
}

export function ConfirmPaymentButton({
  onClick,
  label = "Confirmar pago",
  urgency = "normal",
  variant = "dark",
  className,
}: ConfirmPaymentButtonProps) {
  return (
    <span className="relative inline-flex">
      {/* Ring de atención cuando está vencido */}
      {urgency === "danger" && (
        <span className="absolute -inset-0.5 rounded-full bg-[var(--color-accent)]/50 animate-ping" />
      )}
      <button
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-1.5 rounded-full text-xs font-semibold transition-all active:scale-95",
          // Dark variant (sobre footer charcoal)
          variant === "dark" && "px-3 py-1.5 bg-[var(--color-accent)] text-white hover:brightness-110 shadow-sm",
          // Light variant (sobre superficie blanca)
          variant === "light" && "px-3 py-1.5 bg-[var(--color-accent)] text-white hover:brightness-110 shadow-sm",
          // Urgency modifier
          urgency === "danger" && "animate-pulse",
          className
        )}
      >
        <CheckCircle2
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            urgency === "warning" && "text-[var(--color-warning)]",
            urgency === "danger" && "text-[var(--color-danger)]",
          )}
        />
        {label}
      </button>
    </span>
  );
}
