import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { MsiRepository } from "@/lib/repositories/msi.repo";
import { CyclePaymentsRepository } from "@/lib/repositories/cycle-payments.repo";
import { getCutDateAlert, getPaymentDateAlert, getAnnualFeeAlert } from "@/lib/utils/alerts";
import { computeDebitSummary, computeDebtSummary, computeEffectiveMonth, computePaymentStatus } from "@/lib/domain";
import { computeBillingPeriod } from "@/lib/utils/billing";
import { format, addMonths } from "date-fns";

export async function GET() {
  try {
    const db = getDb();
    const accRepo = new AccountsRepository(db);
    const txRepo  = new TransactionsRepository(db);
    const msiRepo = new MsiRepository(db);
    const cpRepo  = new CyclePaymentsRepository(db);

    const debitAccounts      = accRepo.findByType("debit");
    const investmentAccounts = accRepo.findByType("investment");
    const creditAccounts     = accRepo.findByType("credit");
    const loanAccounts       = accRepo.findByType("loan");

    const { accounts: allDebit, totals: debitTotals } = computeDebitSummary([...debitAccounts, ...investmentAccounts]);
    const allCredit = computeDebtSummary([...creditAccounts, ...loanAccounts]);

    // Cargar pagos confirmados de todas las tarjetas de crédito en batch
    const creditAccountIds = creditAccounts.map((a) => a.id);
    const allCyclePayments = cpRepo.findByAccounts(creditAccountIds);
    const paymentByAccountMonth = new Map(allCyclePayments.map((p) => [`${p.account_id}:${p.cycle_month}`, p]));

    const cardAlerts = creditAccounts.map((acc) => {
      const effectiveMonth = computeEffectiveMonth(acc.cut_date);

      // payment_status aplica al ÚLTIMO CICLO CERRADO (effectiveMonth − 1 mes)
      // El effectiveMonth es el ciclo ABIERTO — todavía no se puede pagar
      const lastClosedMonth = format(
        addMonths(new Date(effectiveMonth + "-01T12:00:00"), -1),
        "yyyy-MM"
      );
      const { periodStart, periodEnd } = computeBillingPeriod(lastClosedMonth, acc.cut_date ?? null);

      const purchases = txRepo.sumPurchasesByPeriod(acc.id, periodStart, periodEnd);
      const credits   = txRepo.sumCreditsByPeriod(acc.id, periodStart, periodEnd);
      const msiTotal  = msiRepo.sumByAccountAndMonth(acc.id, lastClosedMonth);
      const amountDue = Math.max(0, purchases - credits + msiTotal);

      const cyclePayment = paymentByAccountMonth.get(`${acc.id}:${lastClosedMonth}`) ?? null;
      const { status: paymentStatus } = computePaymentStatus(cyclePayment, amountDue);

      return {
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
        payment_status: paymentStatus,
      };
    });

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
