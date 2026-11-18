import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { PageHeader } from "@/components/ui/page-header";

export default function NewTransactionPage() {
  const accounts = new AccountsRepository(getDb()).findAll();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transacciones"
        title="Nueva transacción"
        subtitle="Las compras a MSI se distribuyen automáticamente en cuotas mensuales"
      />
      <TransactionForm accounts={accounts} />
    </div>
  );
}
