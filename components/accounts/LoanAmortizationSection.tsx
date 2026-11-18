"use client";

import { useState } from "react";
import { LoanAmortizationTable } from "./LoanAmortizationTable";
import { ConfirmLoanPaymentDialog } from "./ConfirmLoanPaymentDialog";
import type { AmortizationRow } from "@/lib/domain/types";

interface Props {
  rows: AmortizationRow[];
  accountId: string;
  currentBalance: number;
  monthlyPayment: number;
  annualRate: number;
}

export function LoanAmortizationSection({
  rows,
  accountId,
  currentBalance,
  monthlyPayment,
  annualRate,
}: Props) {
  const [confirmMonth, setConfirmMonth] = useState<string | null>(null);

  return (
    <>
      <LoanAmortizationTable
        rows={rows}
        onConfirmPayment={(month) => setConfirmMonth(month)}
      />
      {confirmMonth && (
        <ConfirmLoanPaymentDialog
          open={true}
          onClose={() => setConfirmMonth(null)}
          accountId={accountId}
          cycleMonth={confirmMonth}
          currentBalance={currentBalance}
          monthlyPayment={monthlyPayment}
          annualRate={annualRate}
        />
      )}
    </>
  );
}
