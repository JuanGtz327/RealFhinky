"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",      icon: LayoutDashboard },
  { href: "/accounts",     label: "Cuentas",         icon: Wallet },
  { href: "/transactions", label: "Transacciones",   icon: ArrowLeftRight },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-56 min-h-screen border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-6 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 mb-8">
        <div className="w-7 h-7 rounded-md bg-[var(--color-accent)] flex items-center justify-center">
          <Wallet className="w-4 h-4 text-[var(--color-bg)]" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-[var(--color-foreground)]">
          Finkhy
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-muted)]">Finkhy v1.0</p>
      </div>
    </aside>
  );
}
