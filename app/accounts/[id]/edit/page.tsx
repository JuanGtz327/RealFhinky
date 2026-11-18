import { getDb } from "@/lib/db";
import { AccountsRepository } from "@/lib/repositories/accounts.repo";
import { notFound } from "next/navigation";
import { AccountForm } from "@/components/accounts/AccountForm";
import { PageHeader } from "@/components/ui/page-header";

export default function EditAccountPage({ params }: { params: { id: string } }) {
  const account = new AccountsRepository(getDb()).findById(params.id);
  if (!account) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuentas"
        title="Editar cuenta"
        subtitle={`${account.name} · ${account.bank}`}
      />
      <AccountForm
        mode="edit"
        initial={{
          id:               account.id,
          name:             account.name,
          type:             account.type,
          bank:             account.bank,
          last4:            account.last4 ?? "",
          credit_limit:     account.credit_limit ?? undefined,
          current_balance:  account.current_balance,
          yield_rate:       account.yield_rate ?? undefined,
          cut_date:         account.cut_date ?? undefined,
          payment_due_date: account.payment_due_date ?? undefined,
          annual_fee:       account.annual_fee ?? undefined,
          annual_fee_date:  account.annual_fee_date ?? "",
        }}
      />
    </div>
  );
}
