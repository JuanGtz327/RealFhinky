"use client";

import { useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { FormDialog } from "@/components/ui/form-dialog";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Button } from "@/components/ui/button";

interface Account { id: string; name: string; bank: string; type: string }

export function NewTransactionModal({
  accounts,
  defaultAccountId,
}: {
  accounts: Account[];
  defaultAccountId?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> Nueva transacción
      </Button>

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva transacción"
        description="Las compras a MSI se distribuyen automáticamente"
        icon={<Receipt className="w-4 h-4" />}
      >
        <TransactionForm
          accounts={accounts}
          initial={defaultAccountId ? { account_id: defaultAccountId } : undefined}
          onSuccess={() => setOpen(false)}
        />
      </FormDialog>
    </>
  );
}
