"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewPlannedTransferModal } from "@/components/accounts/NewPlannedTransferModal";

interface NewPlannedTransferButtonProps {
  accountId: string;
  direction?: "in" | "out";
  label?: string;
}

export function NewPlannedTransferButton({ accountId, direction, label }: NewPlannedTransferButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-95 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        {label ?? "Nueva transferencia"}
      </button>

      <NewPlannedTransferModal
        open={open}
        onClose={() => setOpen(false)}
        accountId={accountId}
        defaultDirection={direction}
      />
    </>
  );
}
