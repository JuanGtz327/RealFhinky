"use client";

/**
 * @author: @kokonutui (edited in-place for Finkhy)
 * @description: Promise Toast — global toast provider with stacked animations
 */

import { X } from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type ToastStatus = "loading" | "success" | "error";

export interface ToastOptions {
  title: string;
  body?: string;
  status: ToastStatus;
  duration?: number;
  onUndo?: () => void;
  onRetry?: () => void;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastCtx {
  toast: (opts: ToastOptions) => number;
  update: (id: number, patch: Partial<ToastOptions>) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;
const TOAST_H = 68;
const GAP = 10;
const VISIBLE = 3;
const STAY_MS = 4000;

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((all) => all.filter((t) => t.id !== id));
  }, []);

  const update = useCallback((id: number, patch: Partial<ToastOptions>) => {
    setItems((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const toast = useCallback((opts: ToastOptions): number => {
    const id = nextId.current++;
    setItems((all) => [...all, { ...opts, id }]);
    return id;
  }, []);

  useEffect(() => {
    for (const item of items) {
      if (
        (item.status === "success" || item.status === "error") &&
        !timers.current.has(item.id)
      ) {
        const tid = window.setTimeout(
          () => dismiss(item.id),
          item.duration ?? STAY_MS
        );
        timers.current.set(item.id, tid);
      }
    }
  }, [items, dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of Array.from(pending.values())) window.clearTimeout(id);
    };
  }, []);

  const ordered = [...items].reverse();

  return (
    <Ctx.Provider value={{ toast, update, dismiss }}>
      {children}
      <MotionConfig reducedMotion="user">
        <section
          aria-label="Notificaciones"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[9999]"
          style={{
            width: 320,
            height:
              Math.min(VISIBLE, ordered.length) * (TOAST_H + GAP) + GAP,
          }}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setExpanded(true);
          }}
          onPointerLeave={() => setExpanded(false)}
        >
          <ol className="absolute inset-x-0 bottom-0">
            <AnimatePresence initial={false}>
              {ordered.map((t, index) => (
                <ToastRow
                  key={t.id}
                  item={t}
                  index={index}
                  expanded={expanded}
                  onDismiss={() => dismiss(t.id)}
                  onRetry={t.onRetry}
                  onUndo={t.onUndo}
                />
              ))}
            </AnimatePresence>
          </ol>
        </section>
      </MotionConfig>
    </Ctx.Provider>
  );
}

// ── ToastRow ──────────────────────────────────────────────────────────────────
function ToastRow({
  item,
  index,
  expanded,
  onDismiss,
  onRetry,
  onUndo,
}: {
  item: ToastItem;
  index: number;
  expanded: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
  onUndo?: () => void;
}) {
  const [swiped, setSwiped] = useState(false);
  const x = useMotionValue(0);
  const fade = useTransform(x, [0, 180], [1, 0]);
  const hidden = index >= VISIBLE;
  const front = index === 0;
  const y = expanded ? -index * (TOAST_H + GAP) : -index * 14;
  const scale = expanded ? 1 : 1 - index * 0.05;

  return (
    <motion.li
      initial={{ y: TOAST_H + 10, opacity: 0, scale: 1 }}
      animate={{ y, scale, opacity: hidden ? 0 : 1 }}
      exit={
        swiped
          ? { x: "120%", opacity: 0, transition: { duration: 0.2 } }
          : {
              y: y + 8,
              opacity: 0,
              scale: scale * 0.97,
              transition: { duration: 0.15, ease: EASE_OUT },
            }
      }
      transition={SPRING}
      style={{
        x,
        zIndex: 100 - index,
        pointerEvents: hidden ? "none" : "auto",
      }}
      className="absolute inset-x-0 bottom-0 origin-top touch-pan-y"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.05, right: 0.85 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 90 || info.velocity.x > 350) {
          setSwiped(true);
          onDismiss();
        }
      }}
    >
      <motion.div
        style={{ height: TOAST_H, opacity: fade }}
        className="flex items-center gap-3 px-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      >
        <motion.div
          animate={{ opacity: front || expanded ? 1 : 0 }}
          initial={false}
          transition={{ duration: 0.18 }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <StatusIcon status={item.status} />

          <div className="min-w-0 flex-1">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={item.title + item.status}
                initial={{ opacity: 0, y: 5, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -5, filter: "blur(2px)" }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                <p className="truncate font-medium text-sm text-[var(--color-foreground)]">
                  {item.title}
                </p>
                {item.body && (
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {item.body}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="popLayout" initial={false}>
            {item.status === "error" && onRetry && (
              <motion.button
                key="retry"
                initial={{ opacity: 0, filter: "blur(2px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  filter: "blur(2px)",
                  transition: { duration: 0.1 },
                }}
                transition={{ duration: 0.2, delay: 0.1 }}
                onClick={onRetry}
                className="shrink-0 flex h-7 items-center px-2.5 rounded-full bg-[var(--color-bg)] text-xs font-medium hover:bg-[var(--color-border)] transition-colors text-[var(--color-foreground)]"
              >
                Reintentar
              </motion.button>
            )}
            {item.status === "success" && onUndo && (
              <motion.button
                key="undo"
                initial={{ opacity: 0, filter: "blur(2px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  filter: "blur(2px)",
                  transition: { duration: 0.1 },
                }}
                transition={{ duration: 0.2, delay: 0.1 }}
                onClick={onUndo}
                className="shrink-0 flex h-7 items-center px-2.5 rounded-full bg-[var(--color-bg)] text-xs font-medium hover:bg-[var(--color-border)] transition-colors text-[var(--color-foreground)]"
              >
                Deshacer
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={onDismiss}
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </motion.div>
    </motion.li>
  );
}

// ── StatusIcon ────────────────────────────────────────────────────────────────
const ICON_COLOR: Record<ToastStatus, string> = {
  loading: "text-[var(--color-muted)]",
  success: "text-[var(--color-success)]",
  error: "text-[var(--color-danger)]",
};

function StatusIcon({ status }: { status: ToastStatus }) {
  const spinning = status === "loading";
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center",
        ICON_COLOR[status]
      )}
    >
      <motion.svg
        viewBox="0 0 32 32"
        fill="none"
        className="size-8"
        aria-hidden
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={
          spinning
            ? { duration: 0.9, ease: "linear", repeat: Infinity }
            : { duration: 0 }
        }
      >
        <motion.circle
          cx={16}
          cy={16}
          r={13}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ rotate: -90, transformOrigin: "16px 16px" }}
          animate={{ pathLength: spinning ? 0.3 : 1 }}
          initial={false}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        />
      </motion.svg>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="absolute inset-0 size-8"
        aria-hidden
      >
        <AnimatePresence initial={false}>
          {status === "success" && (
            <motion.path
              key="check"
              d="M10.5 16.5l3.6 3.5 7.4-7.6"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.25, delay: 0.18, ease: EASE_OUT }}
            />
          )}
          {status === "error" && (
            <motion.path
              key="bang"
              d="M16 10v7.5M16 21.6v.1"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, delay: 0.18, ease: EASE_OUT }}
            />
          )}
        </AnimatePresence>
      </svg>
    </span>
  );
}
