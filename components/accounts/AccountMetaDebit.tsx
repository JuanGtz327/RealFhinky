import { KPICard } from "@/components/ui/kpi-card";
import { formatMXN } from "@/lib/utils/formatters";
import { Landmark, Percent, TrendingUp, CalendarDays } from "lucide-react";

interface AccountMetaDebitProps {
  balance: number;
  yieldRate: number;
}

export function AccountMetaDebit({ balance, yieldRate }: AccountMetaDebitProps) {
  const annualProjection  = balance * (yieldRate / 100);
  const dailyProjection   = annualProjection / 365;
  const monthlyProjection = annualProjection / 12;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KPICard label="Saldo actual"       value={formatMXN(balance)}           variant="capital" icon={<Landmark className="w-4 h-4" />} />
      <KPICard label="Rendimiento anual"  value={`${yieldRate.toFixed(2)}%`}   variant="income"  icon={<Percent className="w-4 h-4" />}  sub="Tasa RAT/GAT" />
      <KPICard label="Proyección anual"   value={formatMXN(annualProjection)}  variant="income"  icon={<TrendingUp className="w-4 h-4" />} sub="Interés estimado" />
      <KPICard label="Proyección mensual" value={formatMXN(monthlyProjection)} variant="neutral" icon={<CalendarDays className="w-4 h-4" />} sub={`${formatMXN(dailyProjection)}/día`} />
    </div>
  );
}
