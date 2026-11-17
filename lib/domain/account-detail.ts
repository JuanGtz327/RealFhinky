import { format, addMonths } from "date-fns";

export function computeEffectiveMonth(cutDate?: number): string {
  const today = new Date();
  if (cutDate && today.getDate() > cutDate) {
    return format(addMonths(today, 1), "yyyy-MM");
  }
  return format(today, "yyyy-MM");
}
