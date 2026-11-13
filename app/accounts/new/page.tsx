import { AccountForm } from "@/components/accounts/AccountForm";

export default function NewAccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">Nueva cuenta</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">Agrega una tarjeta, préstamo o cuenta de débito</p>
      </div>
      <AccountForm mode="create" />
    </div>
  );
}
