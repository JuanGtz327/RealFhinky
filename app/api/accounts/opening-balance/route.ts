import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { billingStartDate } from "@/lib/utils/msi";
import { z } from "zod";

const MsiPlanSchema = z.object({
  merchant:   z.string().min(1),
  amount:     z.number().positive(),
  msi_months: z.number().int().min(2).max(60),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const Schema = z.object({
  account_id:  z.string().min(1),
  purchases:   z.number().min(0).default(0),    // compras normales del mes
  carryover:   z.number().min(0).default(0),    // arrastre opaco
  msi_plans:   z.array(MsiPlanSchema).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { account_id, purchases, carryover, msi_plans } = parsed.data;

    const db      = getDb();
    const accRepo = new AccountsRepository(db);
    const txRepo  = new TransactionsRepository(db);

    const account = accRepo.findById(account_id);
    if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

    // The account's current_balance already reflects the full opening debt.
    // Wizard transactions represent what that balance is composed of — they must NOT
    // double-count it by updating the balance again.
    const originalBalance = account.current_balance;

    const today = new Date().toISOString().substring(0, 10);

    // If registering after the cut date, normal purchases belong to the NEXT billing cycle
    const purchaseDate = (account.cut_date && parseInt(today.substring(8), 10) > account.cut_date)
      ? billingStartDate(today, account.cut_date)
      : today;

    db.transaction(() => {
      // 1. Compras normales del mes → purchase sin MSI
      if (purchases > 0) {
        txRepo.create({
          account_id,
          date:        purchaseDate,
          merchant:    "Saldo inicial del mes",
          amount:      purchases,
          type:        "purchase",
          category:    "Otros",
          notes:       "Registrado en configuración de saldo inicial",
        });
      }

      // 2. Planes MSI activos → se expanden en installments desde su fecha original
      for (const plan of msi_plans) {
        txRepo.create({
          account_id,
          date:       plan.start_date,
          merchant:   plan.merchant,
          amount:     plan.amount,
          type:       "purchase",
          is_msi:     true,
          msi_months: plan.msi_months,
          notes:      "MSI registrado en configuración de saldo inicial",
        });
      }

      // 3. Arrastre opaco → solo se guarda en la cuenta, no genera transacciones
      if (carryover > 0) {
        accRepo.update(account_id, { opening_balance_carryover: carryover });
      }

      // Reset balance to original — wizard transactions describe pre-existing debt,
      // not new charges on top of it.
      db.execute(
        "UPDATE accounts SET current_balance = ? WHERE id = ?",
        [originalBalance, account_id]
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
