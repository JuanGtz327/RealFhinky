import { ReactNode } from "react";
import { FadeIn } from "@/components/ui/animated";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <FadeIn>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-[3px] h-8 rounded-full shrink-0 self-center" style={{ background: "var(--color-accent)" }} />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: "rgba(232,100,60,0.12)", color: "var(--color-accent)" }}>
            {eyebrow}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-[var(--color-foreground)] leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-[var(--color-muted)] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </FadeIn>
  );
}
