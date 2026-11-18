"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewRecurringChargeModal } from "@/components/subscriptions/NewRecurringChargeModal";
import type { Account } from "@/lib/types";

interface NewChargeButtonProps {
  accounts: Account[];
}

export function NewChargeButton({ accounts }: NewChargeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-95 transition-all"
      >
        <Plus className="w-4 h-4" />
        Nueva suscripción
      </button>

      <NewRecurringChargeModal
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
      />
    </>
  );
}
