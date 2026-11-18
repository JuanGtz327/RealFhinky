import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { IncomeOverdueAlert } from "@/lib/domain/income";

interface Props {
  alerts: IncomeOverdueAlert[];
  hideLink?: boolean;
}

export function IncomeOverdueBanner({ alerts, hideLink = false }: Props) {
  if (alerts.length === 0) return null;

  const totalOverdue = alerts.reduce((s, a) => s + a.overdueCount, 0);

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3 animate-in slide-in-from-top-3 duration-500"
      style={{ background: "var(--color-navbar)", borderLeft: "4px solid var(--color-accent)" }}
    >
      <div className="flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.5 badge-accent-pill">
        <AlertTriangle className="w-3.5 h-3.5 animate-pulse" style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>
          Acción
        </span>
      </div>
      <p className="text-sm text-white/80">
        Tienes{" "}
        <span className="font-bold text-white">
          {totalOverdue} {totalOverdue === 1 ? "pago sin confirmar" : "pagos sin confirmar"}
        </span>{" "}
        este mes.{" "}
        {hideLink ? (
          <>Confirma los pagos en las cards de abajo para que el Capital Fin sea correcto.</>
        ) : (
          <>
            <Link href="/income" className="underline text-white/80 hover:text-white transition-colors">
              Ve a Ingresos
            </Link>{" "}
            para registrar los pagos recibidos y que el Capital Fin sea correcto.
          </>
        )}
      </p>
    </div>
  );
}
