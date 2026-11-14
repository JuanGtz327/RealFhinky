import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";

const RowSchema = z.record(z.string(), z.unknown());

const ImportSchema = z.object({
  version: z.number(),
  accounts: z.array(RowSchema),
  transactions: z.array(RowSchema),
  msi_installments: z.array(RowSchema),
  income_sources: z.array(RowSchema),
  income_entries: z.array(RowSchema),
  preferences: z.array(RowSchema).optional(),
});

function insertRows(db: ReturnType<typeof getDb>, table: string, rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const keys = Object.keys(row);
    const placeholders = keys.map(() => "?").join(", ");
    db.execute(
      `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
      Object.values(row)
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Formato de archivo inválido", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const db = getDb();

    db.transaction(() => {
      db.execute("DELETE FROM msi_installments");
      db.execute("DELETE FROM transactions");
      db.execute("DELETE FROM income_entries");
      db.execute("DELETE FROM income_sources");
      db.execute("DELETE FROM accounts");
      db.execute("DELETE FROM user_preferences");

      insertRows(db, "accounts", data.accounts);
      insertRows(db, "income_sources", data.income_sources);
      insertRows(db, "transactions", data.transactions);
      insertRows(db, "msi_installments", data.msi_installments);
      insertRows(db, "income_entries", data.income_entries);
      if (data.preferences) {
        insertRows(db, "user_preferences", data.preferences);
      }
    });

    return NextResponse.json({
      message: "Datos importados correctamente",
      counts: {
        accounts: data.accounts.length,
        transactions: data.transactions.length,
        msi_installments: data.msi_installments.length,
        income_sources: data.income_sources.length,
        income_entries: data.income_entries.length,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al importar datos" }, { status: 500 });
  }
}
