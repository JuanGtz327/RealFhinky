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
