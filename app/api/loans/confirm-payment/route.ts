import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { CyclePaymentsRepository } from "@/lib/repositories/cycle-payments.repo";
import { roundCents } from "@/lib/utils/msi";

const schema = z.object({
  account_id: z.string(),
  cycle_month: z.string().regex(/^\d{4}-\d{2}$/),
  amount_paid: z.number().positive(),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const db = getDb();
    const accRepo = new AccountsRepository(db);
    const cpRepo = new CyclePaymentsRepository(db);

    const account = accRepo.findById(data.account_id);
    if (!account || account.type !== "loan") {
      return NextResponse.json({ error: "Loan account not found" }, { status: 404 });
    }

    const annualRate = account.loan_interest_rate ?? 0;
    const monthlyRate = annualRate / 100 / 12;
    const interestPortion = roundCents(account.current_balance * monthlyRate);
    const principalPortion = roundCents(Math.max(0, data.amount_paid - interestPortion));
    const newBalance = roundCents(Math.max(0, account.current_balance - principalPortion));

    const result = db.transaction(() => {
      const existing = cpRepo.findByAccountAndMonth(data.account_id, data.cycle_month);
      let cp;
      if (existing) {
        cp = cpRepo.update(existing.id, {
          amount_paid: data.amount_paid,
          paid_date: data.paid_date,
          notes: data.notes,
        });
      } else {
        cp = cpRepo.create({
          account_id: data.account_id,
          cycle_month: data.cycle_month,
          amount_due: account.loan_monthly_payment ?? data.amount_paid,
          amount_paid: data.amount_paid,
          paid_date: data.paid_date,
          notes: data.notes,
        });
      }
      const updatedAccount = accRepo.update(data.account_id, { current_balance: newBalance });
      return { cp, updatedAccount };
    });

    return NextResponse.json({ cyclePayment: result.cp, account: result.updatedAccount });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
