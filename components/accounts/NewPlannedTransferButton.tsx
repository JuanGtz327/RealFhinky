"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewPlannedTransferModal } from "@/components/accounts/NewPlannedTransferModal";
import { Button } from "@/components/ui/button";

interface NewPlannedTransferButtonProps {
  accountId: string;
  direction?: "in" | "out";
  label?: string;
}

export function NewPlannedTransferButton({ accountId, direction, label }: NewPlannedTransferButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" />
        {label ?? "Nueva transferencia"}
      </Button>

      <NewPlannedTransferModal
        open={open}
        onClose={() => setOpen(false)}
        accountId={accountId}
        defaultDirection={direction}
      />
    </>
  );
}
