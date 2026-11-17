# Finkhy — Arquitectura del proyecto

## Capas

```
app/           ← Next.js App Router (páginas y API routes)
components/    ← Componentes React (solo presentación)
lib/domain/    ← Lógica de negocio pura (cálculos financieros)
lib/utils/     ← Funciones utilitarias de bajo nivel
lib/repositories/ ← Acceso a datos (CRUD sobre IDatabase)
lib/db/        ← Adaptadores de base de datos
lib/types.ts   ← Tipos compartidos del dominio
```

La regla de dependencia es unidireccional:

```
app → lib/domain → lib/utils
app → lib/repositories → lib/db
components → lib/domain (no repositories directamente)
```

Los componentes y páginas **no** deben realizar cálculos de negocio inline; deben importar desde `lib/domain/`.

---

## `lib/domain/` — Capa de dominio

Funciones puras de cálculo financiero. Cada archivo es independiente.

| Archivo | Exports principales | Qué calcula |
|---|---|---|
| `types.ts` | `FlowRow`, `DebitAccountSummary`, `CreditAccountSummary`, `AccountKpis`, … | Tipos compartidos de la capa |
| `flow.ts` | `computeFlowRows(year, repos)` | Tabla mensual: nomina, abonos, tarjetas, préstamos, capital_inicio/fin |
| `yields.ts` | `computeDebitSummary(accounts)` | Proyección anual/diaria de rendimiento de cuentas débito/inversión |
| `credit.ts` | `computeCreditUtilization(balance, limit)`, `computeDebtSummary(accounts)` | % utilización y nivel de alerta por tarjeta |
| `balance.ts` | `balanceDelta(type, amount, accountType)`, `computeBalanceDiscrepancy(account, pendingMsi, txs)` | Delta de saldo por tipo de transacción; discrepancia real vs Finkhy |
| `breakdown.ts` | `computeBreakdownMatrix(year, repos)` | Matriz año × mes × tarjeta para el desglose |
| `kpis.ts` | `computeAccountKpis(accounts)` | KPIs globales: totalCapital, totalDeuda, totalDisponible |
| `account-detail.ts` | `computeEffectiveMonth(cutDate?)` | Mes efectivo de facturación según el día de corte |
| `index.ts` | Re-exporta todo | Punto de entrada único |

### `computeFlowRows` — Regla V3 (income/purchase neutralidad de transfers)

Solo `income` y `purchase` cuentan en el flujo del dashboard:
- **Nómina**: entradas de `income_sources` via `IncomeRepository`
- **Abonos**: transacciones `type=income` en cuentas débito (depósitos externos ad-hoc)
- **Tarjetas**: `purchase` non-MSI + cuotas MSI en cuentas crédito
- **Préstamos**: `purchase` en cuentas loan
- `transfer_in` y `transfer_out` son **neutrales** — no entran en `ingresos_totales` ni `gastos_totales` (evitar double-count entre cuentas propias)

---

## `lib/utils/` — Utilidades de bajo nivel

| Archivo | Exports principales | Propósito |
|---|---|---|
| `msi.ts` | `roundCents`, `expandMsi`, `billingStartDate`, `getMsiProgress`, `msiElapsed`, `msiRemainingAmount` | Lógica MSI: distribución de cuotas, redondeo canónico |
| `billing.ts` | `computeBillingPeriod(cycleMonth, cutDay)` | Período `periodStart`/`periodEnd` real de un ciclo de facturación |
| `formatters.ts` | `formatMXN`, `formatPercent`, `formatDate`, `calcVariation` | Formateo de display (nunca afectan los cálculos) |
| `alerts.ts` | `getCreditUtilizationAlert`, `getCutDateAlert`, `getPaymentDateAlert`, `getAnnualFeeAlert` | Niveles de alerta (`"ok"` / `"warning"` / `"danger"`) |
| `forecast.ts` | `projectIncomeForMonth`, `generateForecast` | Proyección de flujo de caja futuro |

### `roundCents` — Implementación canónica

```typescript
export const roundCents = (n: number): number => Math.round(n * 100) / 100;
```

Es la **única** implementación autorizada para redondear montos financieros a 2 decimales. No duplicar `Math.round(n * 100) / 100` inline en ningún otro archivo.

### `computeBillingPeriod` — Regla global de tarjetas

Cualquier vista que muestre datos de una tarjeta de crédito **debe** usar `computeBillingPeriod(cycleMonth, cutDay)` para obtener el `periodStart`/`periodEnd` correcto. Nunca asumir que el mes de facturación coincide con `strftime('%Y-%m', date)`.

---

## `lib/repositories/` — Acceso a datos

Implementan la interfaz `IDatabase` (patrón Repositorio) para abstraer SQLite hoy / PostgreSQL mañana.

| Repositorio | Responsabilidad principal |
|---|---|
| `AccountsRepository` | CRUD de cuentas; `findByType`, actualizar saldo |
| `TransactionsRepository` | CRUD de transacciones; expansión automática de MSI al crear; `sumByAccountAndMonth`, `sumPurchasesByPeriod`, `sumCreditsByPeriod` |
| `MsiRepository` | Lectura de `msi_installments`; `sumByAccountAndMonth`, `findByTransaction`, `findByAccount` |
| `IncomeRepository` | CRUD de `income_sources` e `income_entries`; `findEntriesByMonth` |
| `PreferencesRepository` | Tabla `user_preferences` (key/value) |

Los repositorios **no** contienen lógica de negocio más allá de la gestión del delta de saldo. Toda lógica financiera compleja va en `lib/domain/`.

---

## `lib/db/` — Adaptadores de base de datos

```typescript
interface IDatabase {
  query<T>(sql: string, params?: unknown[]): T[];
  execute(sql: string, params?: unknown[]): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}
```

- `lib/db/sqlite.ts` — implementación con `better-sqlite3` (producción)
- `lib/db/postgres.ts` — stub vacío (TODO: migración futura)
- `lib/db/index.ts` — selecciona el adaptador según `DATABASE_URL`
- `lib/db/schema.sql` — schema canónico (usado también en tests)

---

## Convenciones críticas

### Zonas horarias

Fechas almacenadas como texto `YYYY-MM-DD` sin timezone.

**Siempre** construir `Date` desde un string así con el patron noon-anchor:
```typescript
new Date(dateStr + "T12:00:00")  // evita que UTC midnight corra el día un día atrás en México
```

Las comparaciones de fecha son **léxicas sobre strings** (`"2026-11" > "2026-10"`), nunca sobre objetos `Date`.

### Precisión decimal

- Montos almacenados como `REAL` (IEEE 754) en SQLite
- Redondeo de display: `formatMXN` aplica `Intl.NumberFormat`
- Redondeo financiero (almacenamiento): **solo** `roundCents(n)` de `lib/utils/msi.ts`
- Las proyecciones de rendimiento y sumas de flujo **no redondean intermedios**
- Umbral discrepancia real-vs-Finkhy: `> $1 MXN` → warning

### MSI — Distribución de cuotas

```
cuota_base = roundCents(total / meses)
último_mes = roundCents(total - cuota_base × (meses - 1))   // absorbe residual de redondeo
```

`expandMsi(amount, months, startDate)` — el tercer argumento `startDate` es **obligatorio**; sin él las cuotas quedan en meses incorrectos.

### `effectiveMonth` — Mes efectivo de facturación

```typescript
// Si hoy > cut_date, el ciclo actual ya cerró → el mes siguiente es el referente
computeEffectiveMonth(cutDate?) // lib/domain/account-detail.ts
```

Usado en: tabla mensual de `/accounts/[id]`, MSI activos, ciclos de corte, discrepancia de saldo.

---

## Flujo de datos en el dashboard principal

```
app/dashboard/page.tsx (server component)
  ↓ instancia repos
  ↓ llama computeFlowRows(year, repos)      → lib/domain/flow.ts
  ↓ llama computeDebitSummary(accounts)     → lib/domain/yields.ts
  ↓ llama computeDebtSummary(accounts)      → lib/domain/credit.ts
  ↓ pasa datos a componentes presentacionales
        DebitTable, CreditTable, KPICard, …
```

Las mismas funciones de dominio son reutilizadas por las API routes:
- `GET /api/dashboard/flow` → `computeFlowRows`
- `GET /api/dashboard/summary` → `computeDebitSummary` + `computeDebtSummary`
- `GET /api/dashboard/breakdown` → `computeBreakdownMatrix`

---

## Tests

Ubicación: `__tests__/`

| Archivo | Qué prueba | Tipo |
|---|---|---|
| `msi.test.ts` | `expandMsi`, `getMsiProgress` | Unitario puro |
| `billing-period.test.ts` | `computeBillingPeriod` | Unitario puro |
| `alerts.test.ts` | Funciones de alerta | Unitario puro |
| `formatters.test.ts` | Formateo MXN, variación | Unitario puro |
| `forecast.test.ts` | Proyección de ingresos futuros | Unitario puro |
| `repositories.test.ts` | CRUD de repos con SQLite en memoria | Integración ligera |
| `domain-flow.test.ts` | `computeFlowRows` con SQLite en memoria | Integración ligera |
| `domain-yields.test.ts` | `computeDebitSummary` | Unitario puro |
| `domain-credit.test.ts` | `computeCreditUtilization`, `computeDebtSummary` | Unitario puro |
| `domain-balance.test.ts` | `balanceDelta`, `computeBalanceDiscrepancy` | Unitario puro |
| `domain-kpis.test.ts` | `computeAccountKpis` | Unitario puro |

**Criterio de un test válido**: ejercita la función directamente con datos representativos y verifica el valor numérico concreto. Los tests de integración usan SQLite en memoria con el schema real (`lib/db/schema.sql`), nunca mocks de la DB.

Correr todos los checks:
```bash
npm run check   # tsc --noEmit && next lint && vitest run
```
