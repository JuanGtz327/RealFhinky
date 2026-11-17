import type { AlertLevel } from "@/lib/utils/alerts";

export interface LoanColumn {
  id: string;
  name: string;
}

export interface LoanAmount {
  account_id: string;
  name: string;
  amount: number;
}

export interface TarjetaBreakdown {
  id: string;
  name: string;
  bank: string;
  purchases: number;
  msi: number;
  untracked?: number;
  flow_adjustment?: number | null;
}

export interface TransactionDetail {
  accountName: string;
  date: string;
  merchant: string;
  amount: number;
}

export interface NominaSlot {
  date: string;
  isPast: boolean;
  confirmed: boolean;
  amount: number;
}

export interface NominaSourceSlots {
  sourceId: string;
  sourceName: string;
  frequency: string;
  blendedTotal: number;
  slots: NominaSlot[];
}

export interface FlowRow {
  month: string;
  capital_inicio: number;
  nomina: number;
  abonos: number;
  ingresos_totales: number;
  transferencias: number;
  tarjetas: number;
  loans: LoanAmount[];
  gastos_totales: number;
  capital_fin: number;
  variacion: number | null;
  nomina_display?: number;
  nomina_confirmed?: number;
  nomina_remaining?: number;
  is_projected?: boolean;
  is_partial?: boolean;
  tarjetasBreakdown?: TarjetaBreakdown[];
  abonosDetail?: TransactionDetail[];
  transferenciasDetail?: TransactionDetail[];
  nominaSlots?: NominaSourceSlots[];
  otrosGastos?: { id: string; description: string; amount: number }[];
  otrosIngresos?: { id: string; description: string; amount: number }[];
}

export interface DebitAccountSummary {
  id: string;
  name: string;
  bank: string;
  capital: number;
  yield_rate: number;
  annual_projection: number;
  daily_projection: number;
}

export interface DebitTotals {
  capital: number;
  annual_projection: number;
  daily_projection: number;
}

export interface CreditAccountSummary {
  id: string;
  name: string;
  bank: string;
  credit_limit: number;
  current_balance: number;
  available: number;
  utilization_pct: number;
  utilization_level: AlertLevel;
}

export interface AccountKpis {
  totalCapital: number;
  totalDeuda: number;
  totalDisponible: number;
}

export interface BlendedIncomeResult {
  confirmedTotal: number;
  remainingProjected: number;
  blendedTotal: number;
  confirmedCount: number;
  expectedCount: number;
}

export interface MonthlyNominaResult {
  display: number;
  remaining: number;
  blended: number;
  confirmedCount: number;
  expectedCount: number;
}

export interface IncomeConfirmationStatus {
  status: "confirmed" | "partial" | "pending";
  confirmedCount: number;
  expectedCount: number;
  confirmedTotal: number;
  remainingAmount: number;
}
