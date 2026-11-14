"use client";

/**
 * @author: @dorianbaffier (adapted for Finkhy — base-ui drawer, Finkhy palette)
 * @description: Smooth Drawer — bottom sheet with rolling-digit total and spring animation
 */

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  name: string;
  detail?: string;
  price: number;
  quantity?: number;
  badge?: string;   // texto corto para el avatar (ej. "2", "Nov")
  paid?: boolean;   // si ya está pagado (aparece tachado/opaco)
}

export interface SmoothDrawerProps {
  title?: string;
  description?: string;
  items?: OrderItem[];
  currency?: string;
  triggerLabel?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// ─── Rolling digit animation ──────────────────────────────────────────────────

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const digitVariants: Variants = {
  enter:  (dir: number) => ({ y: `${dir * 70}%`,  opacity: 0 }),
  center:              () => ({ y: "0%",           opacity: 1 }),
  exit:   (dir: number) => ({ y: `${dir * -70}%`, opacity: 0 }),
};
const fadeVariants: Variants = {
  enter:  { opacity: 0 },
  center: { opacity: 1 },
  exit:   { opacity: 0 },
};

function RollingAmount({ value, format }: { value: number; format: string }) {
  const reduceMotion = useReducedMotion();
  const previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  useEffect(() => { previous.current = value; }, [value]);

  return (
    <span className="relative inline-flex tabular-nums">
      <span className="sr-only">{format}</span>
      <span aria-hidden="true" className="inline-flex">
        {format.split("").map((char, i) => {
          const slot = format.length - i;
          if (char < "0" || char > "9") return <span key={`s${slot}`}>{char}</span>;
          return (
            <span className="relative inline-flex overflow-hidden" key={`d${slot}`}>
              <AnimatePresence custom={direction} initial={false} mode="popLayout">
                <motion.span
                  animate="center"
                  className="inline-block"
                  custom={direction}
                  exit="exit"
                  initial="enter"
                  key={char}
                  transition={{ duration: 0.24, ease: EASE_OUT }}
                  variants={reduceMotion ? fadeVariants : digitVariants}
                >
                  {char}
                </motion.span>
              </AnimatePresence>
            </span>
          );
        })}
      </span>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SmoothDrawer({
  title        = "Resumen",
  description,
  items        = [],
  currency     = "MXN",
  triggerLabel = "Ver detalle",
  confirmLabel = "Cerrar",
  onConfirm,
  open,
  defaultOpen  = false,
  onOpenChange,
}: SmoothDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const reduceMotion = useReducedMotion();

  const money = new Intl.NumberFormat("es-MX", { style: "currency", currency });
  const total = items.reduce((s, item) => s + item.price * (item.quantity ?? 1), 0);
  const itemCount = items.reduce((s, item) => s + (item.quantity ?? 1), 0);

  const handleOpenChange = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const handleConfirm = () => {
    onConfirm?.();
    handleOpenChange(false);
  };

  return (
    <Drawer onOpenChange={handleOpenChange} open={isOpen}>
      <DrawerTrigger
        render={
          <button
            type="button"
            className="text-sm font-medium text-[var(--color-accent)] hover:underline underline-offset-2 transition-colors"
          />
        }
      >
        {triggerLabel}
      </DrawerTrigger>

      {/* sm: override inset-x-0 con !important para centrar al 40% */}
      <DrawerContent className="bg-[var(--color-surface)] border-[var(--color-border)] sm:!left-[30%] sm:!right-[30%] sm:rounded-2xl">

        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="flex flex-col max-h-[85dvh]"
              initial={reduceMotion ? { opacity: 0 } : { y: 32, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0,  opacity: 1 }}
              exit={reduceMotion   ? { opacity: 0 } : { y: 32, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.8 }}
            >
              {/* Handle */}
              <div aria-hidden="true" className="flex h-5 shrink-0 items-center justify-center">
                <span className="h-1 w-9 rounded-full bg-[var(--color-border)]" />
              </div>

              {/* Header */}
              <div className="shrink-0 px-5 pt-1 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <DrawerTitle className="font-semibold text-base text-[var(--color-foreground)] tracking-tight">
                      {title}
                    </DrawerTitle>
                    <DrawerDescription className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {description ?? `${itemCount} ${itemCount === 1 ? "elemento" : "elementos"}`}
                    </DrawerDescription>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-[var(--color-muted)]">Total pendiente</p>
                    <p className="mt-0.5 font-semibold text-lg text-[var(--color-foreground)] leading-6 tracking-tight">
                      <RollingAmount format={money.format(total)} value={total} />
                    </p>
                  </div>
                </div>

                <button
                  className="mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-[var(--color-accent)] font-medium text-sm text-white outline-none transition-opacity hover:opacity-90 active:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                  onClick={handleConfirm}
                  type="button"
                >
                  {confirmLabel}
                </button>
              </div>

              {/* Items */}
              {items.length > 0 && (
                <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-border)] px-5 py-4">
                  <ul className="space-y-3">
                    {items.map((item, idx) => (
                      <motion.li
                        key={item.id}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 + idx * 0.04, duration: 0.2 }}
                      >
                        {item.paid ? (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-xs font-bold text-[var(--color-success)]">
                            ✓
                          </span>
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-xs font-bold text-[var(--color-accent)]">
                            {item.badge ?? item.detail?.match(/Cuota (\d+)/)?.[1] ?? String(idx + 1)}
                          </span>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className={item.paid
                            ? "truncate text-sm font-medium text-[var(--color-muted)] line-through"
                            : "truncate text-sm font-medium text-[var(--color-foreground)]"
                          }>
                            {item.name}
                          </p>
                          {item.detail && (
                            <p className="truncate text-xs text-[var(--color-muted)]">{item.detail}</p>
                          )}
                        </div>

                        {item.paid ? (
                          <span className="text-sm font-mono tabular-nums text-[var(--color-muted)] line-through">
                            {money.format(item.price * (item.quantity ?? 1))}
                          </span>
                        ) : (
                          <span className="text-sm font-mono tabular-nums text-[var(--color-foreground)]">
                            {money.format(item.price * (item.quantity ?? 1))}
                          </span>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DrawerContent>
    </Drawer>
  );
}
