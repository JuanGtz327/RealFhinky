"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function YearSelector({ year }: { year: number }) {
  const router = useRouter();

  function go(y: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("year", String(y));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => go(year - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-accent)] text-white hover:brightness-95 transition-all">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-4 py-1.5 rounded-md border border-[var(--color-accent)] text-sm font-semibold text-[var(--color-accent)] min-w-[72px] text-center">
        {year}
      </span>
      <button onClick={() => go(year + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-accent)] text-white hover:brightness-95 transition-all">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
