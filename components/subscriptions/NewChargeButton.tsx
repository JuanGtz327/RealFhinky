"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewRecurringChargeModal } from "@/components/subscriptions/NewRecurringChargeModal";
import type { Account } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface NewChargeButtonProps {
  accounts: Account[];
}

export function NewChargeButton({ accounts }: NewChargeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
        Nueva suscripción
      </Button>

      <NewRecurringChargeModal
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
      />
    </>
  );
}
