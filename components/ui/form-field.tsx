"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-[var(--color-muted)]">{label}</Label>
      {children}
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
