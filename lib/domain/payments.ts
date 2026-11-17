import type { CyclePayment } from "@/lib/types";

export type PaymentStatus = "paid" | "partial" | "pending";

export interface CyclePaymentStatus {
  status: PaymentStatus;
  amountDue: number;
  amountPaid: number;
  remaining: number;
}

export function computePaymentStatus(
  payment: CyclePayment | null | undefined,
  amountDue: number
): CyclePaymentStatus {
  if (!payment) {
    return { status: "pending", amountDue, amountPaid: 0, remaining: amountDue };
  }
  const remaining = Math.max(0, payment.amount_due - payment.amount_paid);
  const status: PaymentStatus =
    payment.amount_paid >= payment.amount_due ? "paid" : "partial";
  return { status, amountDue: payment.amount_due, amountPaid: payment.amount_paid, remaining };
}

export function computeCycleAmountDue(
  msiTotal: number,
  directTotal: number,
  creditsTotal: number
): number {
  return Math.max(0, msiTotal + directTotal - creditsTotal);
}
