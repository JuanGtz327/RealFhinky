"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, CreditCard, ArrowLeftRight, TrendingUp, Landmark, Receipt } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FormDialog } from "@/components/ui/form-dialog";
import { AccountForm } from "@/components/accounts/AccountForm";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { IncomeSourceForm } from "@/components/forecast/IncomeSourceForm";
import { useRouter } from "next/navigation";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type ActionKey = "account" | "transaction" | "income" | null;

const ACTIONS = [
  { key: "account"     as const, label: "Nueva cuenta",       icon: CreditCard,     description: "Tarjeta, débito o préstamo" },
  { key: "transaction" as const, label: "Nueva transacción",  icon: ArrowLeftRight, description: "Compra, ingreso o transferencia" },
  { key: "income"      as const, label: "Fuente de ingreso",  icon: TrendingUp,     description: "Nómina, freelance u otro" },
];

interface Account { id: string; name: string; bank: string; type: string }

export function QuickActions() {
  const [open, setOpen]       = useState(false);
  const [active, setActive]   = useState<ActionKey>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const ref                   = useRef<HTMLDivElement>(null);
  const router                = useRouter();

  // Cargar cuentas cuando se abre el dropdown de transacción
  useEffect(() => {
    if (active === "transaction" && accounts.length === 0) {
      fetch("/api/accounts")
        .then((r) => r.json())
        .then((d) => setAccounts(d.accounts ?? []));
    }
  }, [active, accounts.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !active) setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active]);

  function handleAction(key: ActionKey) {
    setOpen(false);
    setActive(key);
  }

  function handleSuccess() {
    setActive(null);
    router.refresh();
  }

  return (
    <>
      <div ref={ref} className="relative ml-auto">
        {/* Botón + */}
        <motion.button
          onClick={() => setOpen((v) => !v)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)]
                     text-white hover:bg-[var(--color-accent)]/90 transition-colors shadow-sm"
          aria-label="Acciones rápidas"
        >
          <motion.div
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <Plus className="w-4 h-4" />
          </motion.div>
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="absolute right-0 top-10 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden z-40"
            >
              <div className="px-3 py-2.5 border-b border-[var(--color-border)]/50">
                <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">
                  Acción rápida
                </p>
              </div>
              <div className="p-1.5">
                {ACTIONS.map(({ key, label, icon: Icon, description }, i) => (
                  <motion.button
                    key={key}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.14, delay: i * 0.04, ease: EASE_OUT }}
                    onClick={() => handleAction(key)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left
                               hover:bg-[var(--color-bg)] transition-colors group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0
                                    bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20
                                    group-hover:bg-[var(--color-accent)] group-hover:border-[var(--color-accent)]
                                    transition-colors">
                      <Icon className="w-4 h-4 text-[var(--color-accent)] group-hover:text-[var(--color-bg)] transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-foreground)]">{label}</p>
                      <p className="text-xs text-[var(--color-muted)]">{description}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dialogs */}
      <FormDialog
        open={active === "account"}
        onClose={() => setActive(null)}
        title="Nueva cuenta"
        description="Tarjeta, préstamo o cuenta de débito"
        icon={<Landmark className="w-4 h-4" />}
      >
        <AccountForm mode="create" onSuccess={handleSuccess} />
      </FormDialog>

      <FormDialog
        open={active === "transaction"}
        onClose={() => setActive(null)}
        title="Nueva transacción"
        description="Las compras a MSI se distribuyen automáticamente"
        icon={<Receipt className="w-4 h-4" />}
      >
        <TransactionForm accounts={accounts} onSuccess={handleSuccess} />
      </FormDialog>

      <FormDialog
        open={active === "income"}
        onClose={() => setActive(null)}
        title="Nueva fuente de ingreso"
        description="Nómina, freelance, renta u otro ingreso recurrente"
        icon={<TrendingUp className="w-4 h-4" />}
      >
        <IncomeSourceForm mode="create" onSuccess={handleSuccess} />
      </FormDialog>
    </>
  );
}
