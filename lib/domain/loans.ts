import { addMonths, format } from "date-fns";
import { roundCents } from "@/lib/utils/msi";
import type { Account, CyclePayment } from "@/lib/types";
import type { AmortizationRow, LoanProgress, LoanKpis } from "./types";

export function computeMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (termMonths <= 0) return 0;
  if (annualRate === 0) return roundCents(principal / termMonths);
  const r = annualRate / 100 / 12;
  const payment =
    (principal * (r * Math.pow(1 + r, termMonths))) /
    (Math.pow(1 + r, termMonths) - 1);
  return roundCents(payment);
}

export function computeAmortizationSchedule(
  account: Account,
  cyclePayments: CyclePayment[],
  currentMonth: string
): AmortizationRow[] {
  const originalAmount = account.loan_original_amount ?? account.current_balance;
  const annualRate = account.loan_interest_rate ?? 0;
  const termMonths = account.loan_term_months ?? 1;
  const monthlyPayment =
    account.loan_monthly_payment ??
    computeMonthlyPayment(originalAmount, annualRate, termMonths);
  const startDateStr = account.loan_start_date ?? currentMonth + "-01";
  const paymentsMadeAtOnboarding = account.loan_payments_made ?? 0;

  const r = annualRate / 100 / 12;
  const cpByMonth = new Map(cyclePayments.map((cp) => [cp.cycle_month, cp]));

  const rows: AmortizationRow[] = [];
  let balance = originalAmount;

  const startMonth = format(
    new Date(
      (startDateStr.length === 7 ? startDateStr : startDateStr.substring(0, 7)) +
        "-01T12:00:00"
    ),
    "yyyy-MM"
  );

  for (let i = 0; i < termMonths; i++) {
    const paymentMonth = format(
      addMonths(new Date(startMonth + "-01T12:00:00"), i),
      "yyyy-MM"
    );
    const paymentNumber = i + 1;
    const isPreOnboarding = paymentNumber <= paymentsMadeAtOnboarding;
    const cp = cpByMonth.get(paymentMonth);

    const interest = roundCents(balance * r);
    const standardPrincipal = roundCents(Math.min(monthlyPayment - interest, balance));
    const standardPayment = roundCents(interest + standardPrincipal);

    const isCurrent = paymentMonth === currentMonth;
    const isPast = paymentMonth < currentMonth;

    let actualPayment: number | undefined;
    if (cp) {
      actualPayment = cp.amount_paid;
    } else if (isPreOnboarding) {
      actualPayment = standardPayment;
    }

    if (actualPayment !== undefined && actualPayment !== standardPayment) {
      const actualInterest = roundCents(balance * r);
      const actualPrincipal = roundCents(
        Math.min(actualPayment - actualInterest, balance)
      );
      balance = roundCents(Math.max(0, balance - actualPrincipal));
    } else {
      balance = roundCents(Math.max(0, balance - standardPrincipal));
    }

    rows.push({
      paymentNumber,
      month: paymentMonth,
      payment: standardPayment,
      principal: standardPrincipal,
      interest,
      remainingBalance: balance,
      isActual: isPreOnboarding || !!cp,
      isPast: isPast || isPreOnboarding,
      isCurrent,
      actualPayment,
    });

    if (balance <= 0) break;
  }

  return rows;
}

export function computeEstimatedPayoffDate(
  currentBalance: number,
  monthlyPayment: number,
  annualRate: number,
  fromMonth: string
): string {
  if (currentBalance <= 0) return fromMonth;
  const r = annualRate / 100 / 12;
  let balance = currentBalance;
  let month = fromMonth;
  let iterations = 0;
  const MAX_ITER = 600;
  while (balance > 0 && iterations < MAX_ITER) {
    const interest = roundCents(balance * r);
    const principal = roundCents(Math.min(monthlyPayment - interest, balance));
    if (principal <= 0) break;
    balance = roundCents(Math.max(0, balance - principal));
    month = format(addMonths(new Date(month + "-01T12:00:00"), 1), "yyyy-MM");
    iterations++;
  }
  return month;
}

export function computeRemainingTerm(
  currentBalance: number,
  monthlyPayment: number,
  annualRate: number
): number {
  if (currentBalance <= 0) return 0;
  const r = annualRate / 100 / 12;
  let balance = currentBalance;
  let months = 0;
  const MAX_ITER = 600;
  while (balance > 0 && months < MAX_ITER) {
    const interest = roundCents(balance * r);
    const principal = roundCents(monthlyPayment - interest);
    if (principal <= 0) break;
    balance = roundCents(Math.max(0, balance - principal));
    months++;
  }
  return months;
}

export function computeLoanProgress(
  account: Account,
  cyclePayments: CyclePayment[]
): LoanProgress {
  const totalPayments = account.loan_term_months ?? 1;
  const paymentsMadeAtOnboarding = account.loan_payments_made ?? 0;
  const paymentsMade = paymentsMadeAtOnboarding + cyclePayments.length;
  const percentComplete = Math.min(
    100,
    roundCents((paymentsMade / totalPayments) * 100)
  );
  const remainingMonths = Math.max(0, totalPayments - paymentsMade);
  const mp =
    account.loan_monthly_payment ??
    computeMonthlyPayment(
      account.loan_original_amount ?? account.current_balance,
      account.loan_interest_rate ?? 0,
      totalPayments
    );
  const estimatedPayoffDate = computeEstimatedPayoffDate(
    account.current_balance,
    mp,
    account.loan_interest_rate ?? 0,
    format(new Date(), "yyyy-MM")
  );
  return {
    paymentsMade,
    totalPayments,
    percentComplete,
    remainingMonths,
    estimatedPayoffDate,
  };
}

export function computeLoanProjectionForMonth(
  account: Account,
  monthStr: string,
  currentMonth: string,
  cyclePayment?: CyclePayment | null
): number {
  const monthlyPayment =
    account.loan_monthly_payment ??
    computeMonthlyPayment(
      account.loan_original_amount ?? account.current_balance,
      account.loan_interest_rate ?? 0,
      account.loan_term_months ?? 1
    );

  const startDateStr = account.loan_start_date ?? currentMonth + "-01";
  const startMonth = format(
    new Date(
      (startDateStr.length === 7 ? startDateStr : startDateStr.substring(0, 7)) +
        "-01T12:00:00"
    ),
    "yyyy-MM"
  );
  const termMonths = account.loan_term_months ?? 1;
  const endDate = addMonths(new Date(startMonth + "-01T12:00:00"), termMonths - 1);
  const endMonth = format(endDate, "yyyy-MM");

  if (monthStr > endMonth) return 0;

  const isPast = monthStr < currentMonth;
  const isCurrent = monthStr === currentMonth;

  if (isPast) {
    return cyclePayment ? cyclePayment.amount_paid : 0;
  }

  if (isCurrent) {
    return cyclePayment ? 0 : monthlyPayment;
  }

  // Future
  return monthlyPayment;
}

export function computeLoanKpis(
  account: Account,
  cyclePayments: CyclePayment[]
): LoanKpis {
  const originalAmount = account.loan_original_amount ?? account.current_balance;
  const annualRate = account.loan_interest_rate ?? 0;
  const termMonths = account.loan_term_months ?? 1;
  const monthlyPayment =
    account.loan_monthly_payment ??
    computeMonthlyPayment(originalAmount, annualRate, termMonths);
  const progress = computeLoanProgress(account, cyclePayments);

  const rows = computeAmortizationSchedule(
    account,
    cyclePayments,
    format(new Date(), "yyyy-MM")
  );
  const paidRows = rows.filter((r) => r.isPast || r.isCurrent);
  const totalInterestPaid = paidRows.reduce((s, r) => s + r.interest, 0);
  const allInterest = rows.reduce((s, r) => s + r.interest, 0);

  return {
    originalAmount,
    currentBalance: account.current_balance,
    monthlyPayment,
    interestRate: annualRate,
    progress,
    totalInterestPaid: roundCents(totalInterestPaid),
    totalInterestProjected: roundCents(allInterest),
  };
}
