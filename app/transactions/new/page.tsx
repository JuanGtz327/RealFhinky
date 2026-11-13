import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionForm } from "@/components/transactions/TransactionForm";

export default function NewTransactionPage() {
  const accounts = new AccountsRepository(getDb()).findAll();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Nueva transacción</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Las compras a MSI se distribuyen automáticamente en cuotas mensuales
        </p>
      </div>
      <TransactionForm accounts={accounts} />
    </div>
  );
}
