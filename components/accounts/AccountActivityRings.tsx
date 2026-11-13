import AppleActivityCard, { type ActivityData } from "@/components/kokonutui/apple-activity-card";

interface AccountActivityRingsProps {
  creditLimit: number;
  currentBalance: number;
  msiCommitted: number;
  name: string;
}

export function AccountActivityRings({
  creditLimit,
  currentBalance,
  msiCommitted,
  name,
}: AccountActivityRingsProps) {
  const limit     = Math.max(creditLimit, 1);
  const available = Math.max(limit - currentBalance, 0);

  const activities: ActivityData[] = [
    {
      label:    "DEUDA",
      color:    "#FF2D55",
      colorEnd: "#FF6B8B",
      size:     200,
      current:  Math.round(currentBalance),
      target:   Math.round(limit),
      unit:     "MXN",
    },
    {
      label:    "MSI",
      color:    "#F59E0B",
      colorEnd: "#FCD34D",
      size:     160,
      current:  Math.round(msiCommitted),
      target:   Math.round(limit),
      unit:     "MXN",
    },
    {
      label:    "LIBRE",
      color:    "#059669",
      colorEnd: "#34D399",
      size:     120,
      current:  Math.round(available),
      target:   Math.round(limit),
      unit:     "MXN",
    },
  ];

  return (
    <AppleActivityCard
      title={name}
      titleAs="h2"
      activities={activities}
      className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6"
    />
  );
}
