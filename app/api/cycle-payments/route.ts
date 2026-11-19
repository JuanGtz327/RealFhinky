import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CyclePaymentsRepository } from "@/lib/repositories/cycle-payments.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { format, addMonths } from "date-fns";
import { z } from "zod";

const CreateCyclePaymentSchema = z.object({
  account_id: z.string().min(1),
  cycle_month: z.string().regex(/^\d{4}-\d{2}$/),
  amount_due: z.number().nonnegative(),
  amount_paid: z.number().positive(),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  paid_from_account_id: z.string().min(1).optional().nullable(),
  confirmed_cycle_total: z.number().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("account_id");
    if (!accountId) {
      return NextResponse.json({ error: "account_id requerido" }, { status: 400 });
    }
    const repo = new CyclePaymentsRepository(getDb());
    const payments = repo.findByAccount(accountId);
    return NextResponse.json({ payments });
  } catch {
    return NextResponse.json({ error: "Error al obtener pagos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateCyclePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const db = getDb();
    const cpRepo = new CyclePaymentsRepository(db);
    const payment = cpRepo.create(parsed.data);

    let transactionsCreated = false;
    const { paid_from_account_id, account_id, amount_paid, paid_date, notes } = parsed.data;

    if (paid_from_account_id) {
      const accRepo = new AccountsRepository(db);
      const creditAccount = accRepo.findById(account_id);
      const debitAccount = accRepo.findById(paid_from_account_id);

      if (creditAccount && debitAccount) {
        const createdAt = new Date(creditAccount.created_at.slice(0, 10) + "T12:00:00");
        const cutDay = creditAccount.cut_date;
        const onboardingEffective = (cutDay && createdAt.getDate() > cutDay)
          ? format(addMonths(createdAt, 1), "yyyy-MM")
          : format(createdAt, "yyyy-MM");
        const isRetroactive = parsed.data.cycle_month < onboardingEffective;

        if (!isRetroactive) {
          const txRepo = new TransactionsRepository(db);
          txRepo.create({
            account_id: account_id,
            date: paid_date,
            merchant: `Pago ${creditAccount.name}`,
            amount: amount_paid,
            category: "Pago tarjeta",
            type: "transfer_in",
            cycle_payment_id: payment.id,
            notes: notes,
          });
          txRepo.create({
            account_id: paid_from_account_id,
            date: paid_date,
            merchant: `Pago ${creditAccount.name}`,
            amount: amount_paid,
            category: "Pago tarjeta",
            type: "transfer_out",
            cycle_payment_id: payment.id,
            notes: notes,
          });
          transactionsCreated = true;
        }
      }
    }

    return NextResponse.json({ payment, transactionsCreated }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al registrar pago";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
