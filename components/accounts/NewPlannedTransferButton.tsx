"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewPlannedTransferModal } from "@/components/accounts/NewPlannedTransferModal";

interface NewPlannedTransferButtonProps {
  accountId: string;
}

export function NewPlannedTransferButton({ accountId }: NewPlannedTransferButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-foreground)] hover:bg-[var(--color-bg)] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Nueva transferencia
      </button>

      <NewPlannedTransferModal
        open={open}
        onClose={() => setOpen(false)}
        accountId={accountId}
      />
    </>
  );
}
