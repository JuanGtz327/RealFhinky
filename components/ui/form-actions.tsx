"use client";

import { Button } from "@/components/ui/button";

interface FormActionsProps {
  loading?: boolean;
  submitLabel: string;
  loadingLabel?: string;
  onCancel: () => void;
}

export function FormActions({ loading, submitLabel, loadingLabel = "Guardando…", onCancel }: FormActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <Button type="submit" disabled={loading}>
        {loading ? loadingLabel : submitLabel}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );
}
