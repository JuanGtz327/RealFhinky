"use client";

import { useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { FormDialog } from "@/components/ui/form-dialog";
import { IncomeSourceForm } from "@/components/forecast/IncomeSourceForm";
import { Button } from "@/components/ui/button";

interface DebitAccountOption {
  id: string;
  name: string;
  bank: string;
}

interface Props {
  debitAccounts?: DebitAccountOption[];
}

export function NewIncomeSourceModal({ debitAccounts = [] }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> Nueva fuente de ingreso
      </Button>

      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva fuente de ingreso"
        description="Nómina, freelance, renta u otro ingreso recurrente"
        icon={<TrendingUp className="w-4 h-4" />}
      >
        <IncomeSourceForm mode="create" onSuccess={() => setOpen(false)} debitAccounts={debitAccounts} />
      </FormDialog>
    </>
  );
}
