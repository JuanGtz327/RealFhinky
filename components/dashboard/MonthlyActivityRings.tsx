import AppleActivityCard, { type ActivityData } from "@/components/kokonutui/apple-activity-card";

interface MonthlyActivityRingsProps {
  ingresos: number;
  gastos: number;
  capital: number;
  ingresosMeta: number;   // promedio últimos 3 meses
  capitalAnterior: number;
  monthLabel: string;
}

export function MonthlyActivityRings({
  ingresos,
  gastos,
  capital,
  ingresosMeta,
  capitalAnterior,
  monthLabel,
}: MonthlyActivityRingsProps) {
  // Target mínimo de 1 para evitar división por cero
  const ingMeta  = Math.max(ingresosMeta, 1);
  const capMeta  = Math.max(capitalAnterior, 1);

  const activities: ActivityData[] = [
    {
      label:    "INGRESOS",
      color:    "#16A34A",
      colorEnd: "#4ADE80",
      size:     200,
      current:  Math.round(ingresos),
      target:   Math.round(ingMeta),
      unit:     "MXN",
    },
    {
      label:    "GASTOS",
      color:    "#FF2D55",
      colorEnd: "#FF6B8B",
      size:     160,
      current:  Math.round(gastos),
      target:   Math.round(ingMeta),
      unit:     "MXN",
    },
    {
      label:    "CAPITAL",
      color:    "#04C7DD",
      colorEnd: "#4DDFED",
      size:     120,
      current:  Math.round(capital),
      target:   Math.max(Math.round(capMeta), 1),
      unit:     "MXN",
    },
  ];

  return (
    <AppleActivityCard
      title={`Resumen — ${monthLabel}`}
      titleAs="h2"
      activities={activities}
      className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6"
    />
  );
}
