import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { IncomeOverdueAlert } from "@/lib/domain/income";

interface Props {
  alerts: IncomeOverdueAlert[];
}

export function IncomeOverdueBanner({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-[var(--color-warning)]/40 px-5 py-4"
      style={{ backgroundColor: "rgba(245,158,11,0.08)" }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            Pagos de nómina pendientes de confirmar
          </p>
          {alerts.map((a) => (
            <p key={a.sourceId} className="text-xs text-[var(--color-muted)]">
              ·{" "}
              <span className="font-medium text-[var(--color-foreground)]">{a.sourceName}</span>
              {" — "}
              {a.overdueCount === 1
                ? "1 pago ya debió haberse recibido"
                : `${a.overdueCount} pagos ya debieron haberse recibido`}
              {a.confirmedCount > 0 &&
                ` (${a.confirmedCount} confirmado${a.confirmedCount > 1 ? "s" : ""})`}
            </p>
          ))}
          <p className="text-xs text-[var(--color-muted)] mt-2">
            Ve a{" "}
            <Link href="/income" className="underline text-[var(--color-foreground)] hover:text-[var(--color-accent)] transition-colors">
              Ingresos
            </Link>
            {" "}para confirmar los pagos recibidos y que el Capital Fin sea correcto.
          </p>
        </div>
      </div>
    </div>
  );
}
