"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormDialog({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  className,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className={cn("sm:max-w-lg p-0 overflow-hidden gap-0 ring-0 border-0", className)}
        showCloseButton={false}
      >
        {/* Dark charcoal header with accent bottom border — matches ConfirmPaymentDialog */}
        <div className="bg-[var(--color-navbar)] px-5 py-4 flex items-start justify-between border-b-[3px] border-[var(--color-accent)]">
          <div>
            <div className={cn("flex items-center mb-0.5", icon ? "gap-2" : "")}>
              {icon && (
                <span className="text-[var(--color-accent)] flex-shrink-0">{icon}</span>
              )}
              <DialogTitle className="text-base font-semibold text-white">
                {title}
              </DialogTitle>
            </div>
            {description && (
              <p className={cn("text-xs text-white/50", icon ? "pl-6" : "")}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors mt-0.5 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
