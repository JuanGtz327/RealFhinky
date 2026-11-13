"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  label: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  summaryRow?: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  label,
  defaultOpen = true,
  children,
  summaryRow,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("w-full rounded-xl border border-[var(--color-border)] overflow-hidden", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 bg-[var(--color-bg)] hover:bg-[var(--color-surface)] transition-colors text-left"
      >
        <ChevronRight
          className={cn(
            "w-4 h-4 text-[var(--color-accent)] shrink-0 transition-transform duration-200",
            open && "rotate-90"
          )}
        />
        <span className="flex-1">{label}</span>
        {!open && summaryRow && (
          <span className="ml-auto shrink-0">{summaryRow}</span>
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-[var(--color-border)]/50">
          {children}
        </div>
      )}
    </div>
  );
}
