import { ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  variant?: "default" | "danger";
}

export function SectionTitle({ children, variant = "default" }: SectionTitleProps) {
  const lineColor = variant === "danger" ? "var(--color-danger)" : "var(--color-accent)";
  const textColor = variant === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-navbar)]";
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-[3px] h-5 rounded-full shrink-0"
        style={{ background: lineColor }}
      />
      <h2 className={`text-base font-semibold ${textColor} flex items-center gap-1.5`}>
        {children}
      </h2>
    </div>
  );
}
