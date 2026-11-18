"use client";

import { useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { FormDialog } from "@/components/ui/form-dialog";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { motion } from "motion/react";

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
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1 }}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus className="w-4 h-4" /> Nueva transacción
      </motion.button>

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
