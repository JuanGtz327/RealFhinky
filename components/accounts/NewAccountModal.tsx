"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FormDialog } from "@/components/ui/form-dialog";
import { AccountForm } from "@/components/accounts/AccountForm";
import { motion } from "motion/react";

export function NewAccountModal() {
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
        <Plus className="w-4 h-4" /> Nueva cuenta
      </motion.button>

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva cuenta"
        description="Agrega una tarjeta, préstamo o cuenta de débito"
      >
        <AccountForm mode="create" onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
