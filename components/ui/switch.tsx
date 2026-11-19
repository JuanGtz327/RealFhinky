"use client"

import { cn } from "cn"

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

function Switch({ checked = false, onCheckedChange, disabled = false, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-muted)]",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-[16px] w-[16px] rounded-full bg-[var(--color-surface)] shadow-md transition-transform",
          checked ? "translate-x-[21px]" : "translate-x-[3px]"
        )}
      />
    </button>
  )
}

export { Switch }
