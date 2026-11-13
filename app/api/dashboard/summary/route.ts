import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { getCreditUtilizationAlert, getCutDateAlert, getPaymentDateAlert, getAnnualFeeAlert } from "@/lib/utils/alerts";


export async function GET() {
  try {
    const db = getDb();
    const accRepo = new AccountsRepository(db);

    // Widget: cuentas débito
    const debitAccounts = accRepo.findByType("debit");
    const investmentAccounts = accRepo.findByType("investment");
    const allDebit = [...debitAccounts, ...investmentAccounts].map((acc) => ({
      id: acc.id,
      name: acc.name,
      bank: acc.bank,
      capital: acc.current_balance,
      yield_rate: acc.yield_rate ?? 0,
      annual_projection: acc.current_balance * ((acc.yield_rate ?? 0) / 100),
      daily_projection: (acc.current_balance * ((acc.yield_rate ?? 0) / 100)) / 365,
    }));

    const debitTotals = {
      capital: allDebit.reduce((s, a) => s + a.capital, 0),
      annual_projection: allDebit.reduce((s, a) => s + a.annual_projection, 0),
      daily_projection: allDebit.reduce((s, a) => s + a.daily_projection, 0),
    };

    // Widget: deuda (crédito + préstamos)
    const creditAccounts = accRepo.findByType("credit");
    const loanAccounts = accRepo.findByType("loan");
    const allCredit = [...creditAccounts, ...loanAccounts].map((acc) => {
      const limit = acc.credit_limit ?? 0;
      const balance = acc.current_balance;
      const utilization = limit > 0 ? (balance / limit) * 100 : 0;
      return {
        id: acc.id,
        name: acc.name,
        bank: acc.bank,
        credit_limit: limit,
        current_balance: balance,
        available: limit - balance,
        utilization_pct: utilization,
        utilization_level: getCreditUtilizationAlert(utilization),
      };
    });

    // Widget: alertas de tarjetas
    const cardAlerts = creditAccounts.map((acc) => {
      const cutAlert = acc.cut_date ? getCutDateAlert(acc.cut_date) : null;
      const payAlert = acc.payment_due_date ? getPaymentDateAlert(acc.payment_due_date) : null;
      const feeAlert = acc.annual_fee_date ? getAnnualFeeAlert(acc.annual_fee_date) : null;
      return {
        id: acc.id,
        name: acc.name,
        bank: acc.bank,
        last4: acc.last4,
        cut_date: acc.cut_date,
        payment_due_date: acc.payment_due_date,
        annual_fee: acc.annual_fee,
        annual_fee_date: acc.annual_fee_date,
        cut_alert: cutAlert,
        payment_alert: payAlert,
        fee_alert: feeAlert,
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
