"use client";

import { useState } from "react";
import { Plus, Landmark } from "lucide-react";
import { FormDialog } from "@/components/ui/form-dialog";
import { AccountForm } from "@/components/accounts/AccountForm";
import { Button } from "@/components/ui/button";

export function NewAccountModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> Nueva cuenta
      </Button>

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva cuenta"
        description="Agrega una tarjeta, préstamo o cuenta de débito"
        icon={<Landmark className="w-4 h-4" />}
      >
        <AccountForm mode="create" onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
