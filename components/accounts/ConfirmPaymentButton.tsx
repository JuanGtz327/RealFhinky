"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      <Button
        onClick={onClick}
        className={cn(
          "rounded-full text-xs font-semibold active:scale-95",
          (variant === "dark" || variant === "light") && "shadow-sm",
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
      </Button>
    </span>
  );
}
