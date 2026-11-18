"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function YearSelector({ year }: { year: number }) {
  const router = useRouter();

  function go(y: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("year", String(y));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button size="icon" onClick={() => go(year - 1)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="px-4 py-1.5 rounded-md border border-[var(--color-accent)] text-sm font-semibold text-[var(--color-accent)] min-w-[72px] text-center">
        {year}
      </span>
      <Button size="icon" onClick={() => go(year + 1)}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
