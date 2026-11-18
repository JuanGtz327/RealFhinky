import { AccountForm } from "@/components/accounts/AccountForm";
import { PageHeader } from "@/components/ui/page-header";

export default function NewAccountPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuentas"
        title="Nueva cuenta"
        subtitle="Agrega una tarjeta, préstamo o cuenta de débito"
      />
      <AccountForm mode="create" />
    </div>
  );
}
