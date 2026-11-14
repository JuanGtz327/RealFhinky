"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, ArrowLeftRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickActions } from "@/components/layout/QuickActions";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
  { href: "/accounts",     label: "Cuentas",       icon: Wallet },
  { href: "/transactions", label: "Transacciones", icon: ArrowLeftRight },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-[var(--color-navbar)]">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-8 px-6">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)]/20">
            <Wallet className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">
            Finkhy
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--color-accent)] text-white font-bold"
                    : "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Acciones rápidas + Settings */}
        <div className="ml-auto flex items-center gap-2">
          <QuickActions />
          <Link
            href="/settings"
            className={cn(
              "flex items-center justify-center rounded-md p-1.5 transition-colors",
              pathname.startsWith("/settings")
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
