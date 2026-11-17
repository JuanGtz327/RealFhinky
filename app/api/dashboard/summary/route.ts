import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { getCutDateAlert, getPaymentDateAlert, getAnnualFeeAlert } from "@/lib/utils/alerts";
import { computeDebitSummary, computeDebtSummary } from "@/lib/domain";

export async function GET() {
  try {
    const db = getDb();
    const accRepo = new AccountsRepository(db);

    const debitAccounts      = accRepo.findByType("debit");
    const investmentAccounts = accRepo.findByType("investment");
    const creditAccounts     = accRepo.findByType("credit");
    const loanAccounts       = accRepo.findByType("loan");

    const { accounts: allDebit, totals: debitTotals } = computeDebitSummary([...debitAccounts, ...investmentAccounts]);
    const allCredit = computeDebtSummary([...creditAccounts, ...loanAccounts]);

    const cardAlerts = creditAccounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      bank: acc.bank,
      last4: acc.last4,
      cut_date: acc.cut_date,
      payment_due_date: acc.payment_due_date,
      annual_fee: acc.annual_fee,
      annual_fee_date: acc.annual_fee_date,
      cut_alert:     acc.cut_date         ? getCutDateAlert(acc.cut_date)              : null,
      payment_alert: acc.payment_due_date ? getPaymentDateAlert(acc.payment_due_date)  : null,
      fee_alert:     acc.annual_fee_date  ? getAnnualFeeAlert(acc.annual_fee_date)     : null,
    }));

    return NextResponse.json({
      debit: { accounts: allDebit, totals: debitTotals },
      credit: { accounts: allCredit },
      card_alerts: cardAlerts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
