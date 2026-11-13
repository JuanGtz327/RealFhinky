import { getDb } from "@/lib/db";
import { TransactionsRepository } from "@/lib/repositories/transactions.repo";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { notFound } from "next/navigation";

export default function EditTransactionPage({ params }: { params: { id: string } }) {
  const db     = getDb();
  const tx     = new TransactionsRepository(db).findById(params.id);
  if (!tx) notFound();

  const accounts = new AccountsRepository(db).findAll();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Editar transacción</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">{tx.merchant ?? tx.description ?? tx.id}</p>
      </div>
      <TransactionForm
        accounts={accounts}
        mode="edit"
        initial={{
          id:          tx.id,
          account_id:  tx.account_id,
          date:        tx.date,
          merchant:    tx.merchant ?? "",
          description: tx.description ?? "",
          amount:      tx.amount,
          category:    tx.category ?? "",
          type:        tx.type,
          is_msi:      tx.is_msi,
          msi_months:  tx.msi_months ?? undefined,
          notes:       tx.notes ?? "",
        }}
      />
    </div>
  );
}
