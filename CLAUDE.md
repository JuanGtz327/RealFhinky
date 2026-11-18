# Finkhy — Financial Dashboard

## Stack
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **DB actual**: SQLite via `better-sqlite3`
- **DB futura**: PostgreSQL (patrón Repository — cambiar solo con `DATABASE_URL`)
- **Lenguaje**: TypeScript
- **Gráficas**: Recharts
- **Fechas**: date-fns
- **Validación**: Zod

## Paleta de colores (Warm Light Theme)
Definida en `globals.css` como CSS variables, con bridge tokens para shadcn en `tailwind.config.ts`.
Cambiar solo esos archivos para re-tematizar toda la app.

```
--color-bg          #F5F3EE   Warm Cream — fondo principal
--color-surface     #FFFFFF   White — tarjetas, paneles
--color-border      #E5E2DC   Warm Gray — bordes y separadores
--color-accent      #E8643C   Coral Orange — acción principal
--color-muted       #8C8C88   Warm Stone — texto secundario, labels
--color-foreground  #1A1A1A   Charcoal — texto principal
--color-navbar      #1A1A1A   Charcoal — navbar y section headings

-- Alertas (no cambiar semántica)
--color-success     #3B8A6B   Sage Green — positivo, crecimiento
--color-warning     #F59E0B   Amarillo — precaución, próximo a vencer
--color-danger      #DC2626   Rojo — negativo, urgente, deuda alta
```

## Dominio: Decisiones clave
- **MSI**: Se expanden en `msi_installments` al guardar la transacción.
  - Cuota base = `Math.round(total / meses * 100) / 100` (precisión decimal, NO floor)
  - Residual = `total - (cuota_base * (meses-1))` → último mes absorbe el ajuste
  - `expandMsi(amount, months, startDate)` — el tercer argumento `startDate` es OBLIGATORIO; sin él las cuotas quedan en meses incorrectos
- **Tipos de transacción y semántica**:
  - `income` — ingreso externo a cuenta débito (nómina, transferencia recibida de tercero). Suma al saldo.
  - `purchase` — gasto/cargo. Crédito: sube deuda. Débito: resta saldo.
  - `transfer_in` — pago recibido en tarjeta de crédito (reduce deuda) o entrada desde cuenta propia a débito. Neutral en dashboard global.
  - `transfer_out` — salida desde débito hacia otra cuenta propia. Neutral en dashboard global.
  - **Regla**: solo `income` y `purchase` cuentan en el flujo del dashboard; `transfer_*` son neutrales (evitar double-count).
- **Transferencias entre cuentas propias**: No cuentan como gasto ni ingreso en el dashboard global (evitar double-count)
- **Columnas de préstamos**: Dinámicas — se genera una columna por cada cuenta `type=loan` activa
- **Capital Fin Mes**: `Capital Inicio + Ingresos Totales - Gastos Totales`
- **Capital Inicio (dashboard flow)**: Para el mes actual, anclar a `patrimonioActual` (suma de saldos reales de cuentas débito). Para meses futuros, proyectar acumulado.
- **Proyección de ingresos futuros**: Se calcula desde `income_sources` usando `projectMonthlyIncome(source)`:
  - weekly → base × 4; biweekly → base × 2; monthly → base × 1; custom → base × round(30/days)
- **Proyección Anual débito**: `Capital × (yield_rate / 100)`
- **Proyección Diaria débito**: `Proyección Anual / 365`
- **% Utilización crédito**: Verde <30%, Amarillo 30-70%, Rojo >70%
- **Discrepancia saldo crédito**: `finkhyBalance = Σ cuotas MSI pendientes (desde effectiveMonth) + compras directas no-MSI − transfer_in + opening_balance_carryover`. `balanceDiff = account.current_balance − finkhyBalance`. Positivo → gastos no rastreados en Finkhy. Negativo → diferencia de redondeo MSI. Umbral: >$1 MXN muestra `ShieldAlert` warning; ≤$1 muestra `ShieldCheck` verde.
- **effectiveMonth**: Si hoy > `cut_date`, el ciclo de facturación activo ya cerró → usar el SIGUIENTE mes como referencia. Si hoy ≤ `cut_date`, usar el mes actual. Se usa en `isCurrent`/`isFuture` de la tabla mensual, MSI activos pendientes, y ciclos de corte. Fórmula: `(account.cut_date && today.getDate() > account.cut_date) ? addMonths(today, 1) : today`.
- **Período de facturación vs mes calendario**: Distintos `cut_date` → distintos rangos de fecha para el mismo mes. Usar `computeBillingPeriod(cycleMonth, cutDay)` de `lib/utils/billing.ts` para obtener `periodStart`/`periodEnd` correctos por tarjeta. NUNCA asumir que el mes de facturación coincide con `strftime('%Y-%m', date)` al sumar gastos por ciclo.
  - **REGLA GLOBAL**: Cualquier vista, tabla, widget o proyección que muestre datos de una tarjeta de crédito DEBE usar el período de facturación (`computeBillingPeriod`), no el mes calendario. Esto incluye: tabla mensual en `/accounts/[id]`, desglose del dashboard, `NextCyclePreview`, MSI activos, y cualquier componente futuro con status de crédito. Antes de implementar o modificar cualquier cálculo de tarjeta, verificar que usa `periodStart`/`periodEnd` correcto.
- **Desglose por tarjeta**: cada celda de la matriz usa `computeBillingPeriod` por cuenta. Siempre sumar: `purchases (period) + msi (billing month) + annual_fee (si cae en period) − credits (transfer_in en period)`. NO usar solo el mes calendario.
- **Anualidad en ciclos de corte**: Se inyecta automáticamente en `NextCyclePreview` si `annual_fee_date` cae dentro de `periodStart..periodEnd` y NO existe ya una transacción con `category = "Anualidad"` en ese rango. Se muestra como ítem proyectado con badge "Anualidad".
- **transfer_in en tarjetas de crédito**: son abonos/devoluciones que reducen deuda. Se muestran en `NextCyclePreview` como créditos (verde, `−$amount`). En el desglose se restan del total del período. El label en el formulario es "Pago / Abono / Devolución".
- **Moneda**: Solo MXN, formato `$#,###.00`
- **Precisión decimal**: Montos almacenados como `REAL` (IEEE 754 float) en SQLite. Redondeo a 2 decimales se hace con `roundCents(n)` de `lib/utils/msi.ts` — es la única implementación autorizada; NO reinventar `Math.round(n * 100) / 100` inline. Las proyecciones de rendimiento y sumas de flujo no redondean intermedios; `formatMXN` aplica el redondeo de display. El umbral de discrepancia real-vs-Finkhy es >$1 MXN.
- **Zonas horarias**: Fechas almacenadas como texto `YYYY-MM-DD` sin timezone. Al construir `Date` desde un string así, usar siempre el patrón noon-anchor: `new Date(dateStr + "T12:00:00")` para evitar que JS interprete UTC midnight y corra el día un día atrás en México (UTC-6). Las comparaciones de fecha son léxicas sobre strings (`"2026-11" > "2026-10"`), nunca sobre objetos `Date`. Si el app se migra a un servidor UTC (PostgreSQL), el cálculo de `effectiveMonth` necesitará timezone explícita.
- **Capa de dominio**: Las funciones puras de cálculo viven en `lib/domain/`. Las funciones de bajo nivel (redondeo, billing period, MSI expansion, alertas, formatters) viven en `lib/utils/`. Los componentes y páginas NO deben realizar cálculos de negocio inline — deben importar desde `lib/domain/`.
- **Confirmación de pagos (`cycle_payments`)**: Tabla separada que almacena la confirmación manual del usuario de que pagó un ciclo de facturación. Semántica:
  - Un registro por `(account_id, cycle_month)` — constraint UNIQUE. Para actualizar (pago parcial → total), usar PUT, no crear otro registro.
  - Aplica solo a cuentas `type=credit` y `type=loan`. Las cuentas débito no tienen ciclos de facturación.
  - `amount_due`: snapshot del total del ciclo al momento de confirmar. No se recalcula; es histórico.
  - `amount_paid`: lo que el usuario declara haber pagado. Puede ser menor (pago parcial), igual (pago total), o mayor (pago con extra) al `amount_due`.
  - **Status derivado** (NO almacenado): `amount_paid >= amount_due` → `"paid"` (verde); `0 < amount_paid < amount_due` → `"partial"` (amarillo); sin registro → `"pending"`. La función `computePaymentStatus()` en `lib/domain/payments.ts` es la única fuente de esta lógica.
  - **NO auto-detectar**: registrar un `transfer_in` en la cuenta NO marca el ciclo como pagado. Son dos acciones independientes. El `transfer_in` solo afecta el saldo contable; la confirmación de pago es una declaración del usuario.
  - `paid_date`: fecha en que el usuario realizó el pago en su banco (puede diferir de la fecha del ciclo).
- **Cargos recurrentes (`recurring_charges`)**: Suscripciones y servicios periódicos vinculados a una cuenta (crédito o débito). Semántica:
  - Entidad independiente con `account_id` NOT NULL. Si se mueve a otra tarjeta, actualizar `account_id`. Si se cancela, poner `end_date` o `is_active = 0`.
  - Frecuencias por **meses** (no días): monthly=1, bimonthly=2, quarterly=3, semiannual=6, annual=12, custom=custom_interval_months. Diferencia intencional con income_sources que usa días.
  - `isChargeExpectedInMonth(charge, monthStr)` determina si un mes cae en ciclo de cargo usando start_date + frequency + end_date.
  - Para tarjetas de crédito: los cargos recurrentes se proyectan usando **billing period** (`isChargeInBillingPeriod`), NO mes calendario. Regla global de billing period aplica.
  - Para cuentas débito: los cargos recurrentes se proyectan por mes calendario.
  - **Confirmación manual**: NO auto-match contra transacciones reales. El usuario confirma explícitamente cada cargo via `recurring_charge_entries`.
  - En el flow table, los cargos recurrentes se suman al total de Tarjetas por tarjeta: `tarjetas += purchases + msi + recurringCharges + untracked + flowAdjustment`.
  - Temporal: mes actual = remaining-only (no confirmados), futuro = blended, pasado = solo confirmados.
- **Transferencias planificadas (`planned_transfers`)**: Movimientos de dinero esperados asociados a una cuenta débito. Semántica:
  - `direction`: `"in"` = dinero que espero recibir (alimenta Abonos en flow), `"out"` = dinero que planeo enviar (alimenta Transferencias en flow).
  - Frecuencias por **días** (espejo de income_sources): weekly, biweekly, monthly, custom, one_time.
  - Confirmación manual via `planned_transfer_entries`. Mismo patrón blending que income_sources.
  - Temporal: mes actual = remaining-only, futuro = blended, pasado = solo confirmados.
- **Préstamos (`type=loan`)**: Cuentas de préstamo con lógica propia de amortización. Semántica:
  - Campos específicos en `accounts`: `loan_original_amount`, `loan_interest_rate`, `loan_term_months`, `loan_monthly_payment`, `loan_start_date`, `loan_payments_made`.
  - **Amortización francesa** (la más común en México): `M = P × [r(1+r)^n] / [(1+r)^n - 1]`. Para tasa 0%: `M = P / n`.
  - **Mid-life onboarding**: `loan_payments_made` registra cuántos pagos se hicieron ANTES de Finkhy. Post-onboarding, los pagos se cuentan desde `cycle_payments`. Total: `loan_payments_made + cycle_payments.count`.
  - **Pagos variables**: el usuario puede pagar más o menos que la mensualidad estándar. Al confirmar un pago, se actualiza `current_balance` restando la porción a capital (`amount_paid - interés_del_mes`). La tabla de amortización recalcula desde el nuevo saldo.
  - **Confirmación de pago**: reutiliza `cycle_payments`. Endpoint dedicado `POST /api/loans/confirm-payment` que envuelve en transacción DB: (1) upsert cycle_payment, (2) update `accounts.current_balance -= principal_portion`.
  - **Proyección en flow table**: pasado = monto confirmado de cycle_payments; actual = mensualidad si no confirmado; futuro = mensualidad si dentro del plazo restante.
  - `current_balance` es la fuente de verdad del saldo pendiente. Se actualiza al confirmar cada pago.
  - Lógica de dominio en `lib/domain/loans.ts`: `computeMonthlyPayment`, `computeAmortizationSchedule`, `computeLoanProgress`, `computeEstimatedPayoffDate`, `computeRemainingTerm`, `computeLoanProjectionForMonth`, `computeLoanKpis`.
  - **UI**: `AccountMetaLoan` (KPIs) + `LoanAmortizationTable` (tabla completa capital/interés) en `/accounts/[id]`. Sin página `/loans` dedicada.

## Schema DB — Cambios recientes
- `accounts` → columna `opening_balance_carryover REAL` (arrastre opaco al onboardear)
- `income_sources` → columna `custom_interval_days INTEGER` (para frecuencia custom)
- `user_preferences` → tabla nueva (key TEXT PK, value TEXT) para preferencias UI
- `UpdateAccountInput` incluye `opening_balance_carryover?: number`
- `cycle_payments` → tabla nueva. Columnas: `id`, `account_id`, `cycle_month` (YYYY-MM), `amount_due`, `amount_paid`, `paid_date`, `notes`, `created_at`. UNIQUE en `(account_id, cycle_month)`.
- `recurring_charges` → tabla nueva. Columnas: `id`, `name`, `account_id` (FK NOT NULL), `frequency`, `base_amount`, `is_variable`, `is_active`, `start_date`, `end_date`, `custom_interval_months`, `category`, `notes`, `created_at`.
- `recurring_charge_entries` → tabla nueva. Columnas: `id`, `recurring_charge_id` (FK), `date`, `amount`, `notes`, `created_at`.
- `planned_transfers` → tabla nueva. Columnas: `id`, `name`, `account_id` (FK NOT NULL), `direction` (in/out), `frequency`, `base_amount`, `is_variable`, `is_active`, `start_date`, `end_date`, `custom_interval_days`, `notes`, `created_at`.
- `planned_transfer_entries` → tabla nueva. Columnas: `id`, `planned_transfer_id` (FK), `date`, `amount`, `notes`, `created_at`.
- `accounts` → 6 columnas nuevas para préstamos: `loan_original_amount REAL`, `loan_interest_rate REAL`, `loan_term_months INTEGER`, `loan_monthly_payment REAL`, `loan_start_date TEXT`, `loan_payments_made INTEGER`.

## Base de datos — Archivos y estado
- **Archivos DB ignorados en git**: `finkhy.db`, `finkhy.db-shm`, `finkhy.db-wal`, `finkhy_seed.sql`
- **Seed/dump**: `finkhy_seed.sql` en la raíz — dump SQLite completo del estado real (escenario con Amex, Banorte, BBVA, etc.). Regenerar con: `sqlite3 finkhy.db .dump > finkhy_seed.sql`
- **Reconciliación de saldos**: Si `balanceDiff ≠ 0` y el banco ya tenía un crédito baked en el saldo inicial, la solución es: (1) agregar la transacción para que los ciclos queden correctos, (2) resetear `current_balance` manualmente via SQL UPDATE al valor real del banco. No agregar la transacción dos veces.

## Tailwind v4 — Gotchas críticos
- **No usar template literals para clases condicionales**: el JIT scanner no las detecta. Usar JSX ternario con elementos separados que tengan clases completas estáticas.
  ```tsx
  // MAL: className={`${paid ? "bg-green-500" : "bg-red-500"}`}
  // BIEN:
  {paid ? <span className="bg-[var(--color-success)]">…</span>
        : <span className="bg-[var(--color-accent)]">…</span>}
  ```
- **CSS vars hex NO soportan modificador de opacidad de Tailwind**: `bg-[var(--color-accent)]/10` NO funciona cuando la variable está definida como hex (#E8643C). Tailwind necesita el valor en formato RGB para interpolar la opacidad. Solución: definir clases con `rgba()` directamente en `globals.css`:
  ```css
  .row-highlight-current       { background-color: rgba(232, 100, 60, 0.12); }
  .row-highlight-current:hover { background-color: rgba(232, 100, 60, 0.18); }
  .row-highlight-negative       { background-color: rgba(220, 38, 38, 0.05); }
  .row-highlight-negative:hover { background-color: rgba(220, 38, 38, 0.08); }
  ```
  Estas clases están definidas en `globals.css` y usadas en `components/ui/data-table.tsx` para highlight de filas.
- **CSS vars con fallback `m-(--var,0px)`**: la sintaxis de Tailwind v4 `m-(--drawer-inset,0px)` no siempre compila el var(). Para overrides de posición en drawers/modales, usar `!left-[30%] !right-[30%]` con `!important` directamente.
- **base-ui Drawer** (`@base-ui/react/drawer`): NO es vaul. No tiene `activeSnapPoint`, `fadeFromIndex`, `setActiveSnapPoint`. El DrawerContent usa `data-[swipe-axis=y]:inset-x-0`; para centrarlo en desktop usar `sm:!left-[30%] sm:!right-[30%] sm:rounded-2xl`.

## Componentes Kokonut UI instalados
- `empty-state` — empty states con animación de entrada
- `promise-toast` — sistema de toasts (provider + hook `useToast`)
  - API: `useToast()` → `{ toast }`. `toast({ title, body, status })` — NO acepta `promise:`, `successTitle:` ni otras props.
- `slide-to-confirm` — confirmación de acciones destructivas
- `smooth-drawer` — bottom sheet con animación spring y dígitos rolling. Interfaz `OrderItem { id, name, detail?, price, quantity?, badge?, paid? }`

## Estructura de rutas
```
/                        → redirect a /dashboard
/dashboard               → vista general (5 secciones)
/accounts                → lista de todas las cuentas
/accounts/[id]           → detalle de cuenta (crédito o débito)
/transactions            → todas las transacciones (global)
/income                  → gestión de fuentes de ingreso y confirmación
/subscriptions           → gestión centralizada de suscripciones/servicios recurrentes
/forecast                → pronósticos de flujo de caja
/settings                → configuración usuario (preferencias, export/import, reset/reseed)
```

## Dashboard Principal — 2 tablas principales + 3 widgets

### Tabla 1: Flujo General Mensual
Mes | Capital Inicio | Nómina | Abonos | Ingresos Totales | Transferencias | Tarjetas | [Préstamo X dinámico]... | Gastos Totales | Capital Fin | % Variación

### Tabla 2: Desglose por Tarjeta
Año (colapsable) | Mes | [Tarjeta 1] | [Tarjeta 2] | ... | Total
- Meses pasados: gasto real
- Mes actual: real acumulado (resaltado)
- Meses futuros: proyección MSI + recurrentes (cursiva)

### Widget: Cuentas Débito
Banco | Capital | Rendimiento % | Proyección Anual | Proyección Diaria
+ Fila de totales al pie

### Widget: Deuda
Deuda | Línea Crédito | Libre | Monto | Línea %
Colores en % utilización: verde/amarillo/rojo

### Widget: Tarjetas
Tarjeta | Fecha Corte | Fecha Pago | Anualidad | Fecha Cobro Anualidad
Alertas: 🟡 corte ≤7d | 🔴 pago ≤3d | 🟡 anualidad ≤30d

## Schema DB (SQLite → PostgreSQL)

### accounts
id, name, type (credit|debit|loan|investment), bank, last4,
credit_limit, current_balance, yield_rate,
cut_date, payment_due_date, annual_fee, annual_fee_date,
is_active, created_at, updated_at

### transactions
id, account_id, date, merchant, description, amount, category,
type (purchase|income|transfer_in|transfer_out),
is_msi, msi_months, msi_monthly_amount, msi_residual, msi_start_date,
notes, created_at

### msi_installments
id, transaction_id, account_id, month (YYYY-MM), amount, is_last

### income_sources
id, name, frequency (weekly|biweekly|monthly|custom),
base_amount, is_variable, is_active, start_date, created_at

### income_entries
id, income_source_id, date, amount, notes, created_at

## Pruebas (funcionales, no de UI)
- Lógica MSI: distribución correcta de cuotas y residual
- Cálculo Capital Fin Mes
- Proyección anual/diaria de rendimiento débito
- % utilización de crédito
- Generación de columnas dinámicas de préstamos
- Forecast: proyección de flujo de caja mes a mes
- Alertas de fechas (corte, pago, anualidad)
- Adaptador DB: misma interfaz SQLite y PostgreSQL
- Repositorios: CRUD de cuentas, transacciones, ingresos

## Kokonut UI

This project installs components from Kokonut UI, a shadcn/ui registry.
The registry is set in components.json as "@kokonutui".

- **Before building any animated or interactive component from scratch**, check
  Kokonut UI first: https://kokonutui.com/llms.txt lists every component.
- Install with the shadcn CLI, never by pasting code:
  `npx shadcn@latest add @kokonutui/<name>`
- **Installed components are project code. Edit them in place — never wrap them.**
- After installing, theme the component with Finkhy CSS variables (replace zinc/emerald/rose hardcoded colors).
- Currently installed: `empty-state`, `promise-toast`, `slide-to-confirm`, `smooth-drawer`
- Do NOT create custom components that duplicate what a Kokonut component already provides.

## Reglas de UI — Normalización estricta

Toda la UI sigue un sistema normalizado. Cada patrón visual tiene una sola fuente de verdad.
**No crear componentes custom si existe un primitivo shadcn o Kokonut que lo resuelva.**

### Colores
- SOLO usar CSS variables: `var(--color-bg)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-accent)`, `var(--color-muted)`, `var(--color-foreground)`, `var(--color-navbar)`, `var(--color-success)`, `var(--color-warning)`, `var(--color-danger)`
- Para variantes con alpha: `bg-[var(--color-accent)]/10` — NUNCA colores hardcoded de Tailwind (slate-*, emerald-*, amber-*, white, etc.)
- Section headings usan `text-[var(--color-navbar)]`

### Inputs
- Text/number/date → shadcn `Input` (`h-8 py-1`)
- Native `<select>` → clase `.select-field` (appearance:none + SVG chevron) con `h-8 pl-2.5 pr-9 py-1`
- Labels → shadcn `Label`
- Layout campo → `FormField` (label + input + error)
- Botones submit/cancel → `FormActions`
- Todos los inputs comparten `h-8` para altura uniforme

### Botones
- Primary → shadcn `Button variant="default"`
- Secondary → `Button variant="outline"`
- Danger → `Button variant="destructive"`
- Ghost → `Button variant="ghost"`
- Hover: `brightness-95` (NO scale — causa scrollbar en modales)

### Modales
- Form modals → `FormDialog` (wraps shadcn Dialog)
- Dialog usa CSS vars directos (`bg-[var(--color-surface)]`, NO `bg-popover`)
- Overlay: `bg-black/50 backdrop-blur-sm`

### Tablas
- Todas → `DataTable` (shadcn Table primitives)
- Rows: `hover:bg-[var(--color-bg)] transition-colors` para legibilidad

### Jerarquía de cards (clases en `globals.css`)
| Clase | Uso | Hover |
|-------|-----|-------|
| `card-elevated` | Display estático (KPIs, summaries) | ninguno |
| `card-sweep` | Links navegables (`<Link>`) | Orange sweep L→R, texto → white |
| `card-lift` | Data interactiva | translateY(-2px) + shadow |

- Durante sweep: hijos con `group-hover:text-white`, StatusBadge con `group-hover:bg-white/60`
- `card-sweep:hover` pone `border-color: transparent` (el fill cubre el borde)

### Bordes
- Estándar: `border border-[var(--color-border)]` (1px)
- Solo `border-2` para empty states con `border-dashed`

### Tipografía
| Nivel | Clases |
|-------|--------|
| Título página (h1) | `text-2xl font-semibold text-[var(--color-foreground)]` |
| Título sección (h2) | `text-base font-semibold text-[var(--color-navbar)]` |
| Body | `text-sm text-[var(--color-foreground)]` |
| Helper/muted | `text-xs text-[var(--color-muted)]` |

### Spacing
| Nivel | Clase |
|-------|-------|
| Contenedor página | `space-y-8` |
| Dentro de sección | `space-y-3` |
| Grid de cards/KPIs | `gap-4` |
| Campos de form | `space-y-5`, max-width: `max-w-lg` |

### Animaciones
- Page headers → `FadeIn`
- KPI grids → `StaggerGrid`
- Empty states → Kokonut `EmptyState` (`@/components/kokonutui/empty-state`)
- Toasts → Kokonut `ToastProvider`/`useToast` (`@/components/kokonutui/promise-toast`)

### Navbar
- Active tab: `bg-[var(--color-accent)] text-white font-bold` (orange pill)
- Inactive: `text-[var(--color-accent)]` (orange text)
- Logo icon: orange

## Regla de pruebas funcionales

Todo cambio en lógica de cálculo **requiere** un test que lo cubra. Los tests deben ser funcionales y verificar comportamiento real, no simplemente que el código compila o que un componente renderiza.

**Criterio de un buen test:**
- Ejercita la función/repositorio directamente con datos reales representativos
- Verifica el valor numérico concreto resultante, no solo que "no lanzó error"
- Cubre el caso que motivó el cambio (el escenario del bug o la nueva regla)
- Si toca lógica de período de facturación, incluye un caso donde la compra cae ANTES del corte de mes calendario pero DENTRO del ciclo de facturación

**Qué NO es un test válido:**
- Render tests de componentes React que solo verifican que no crashea
- Mocks que no tocan la DB real (usar SQLite en memoria con el schema real)
- Tests que pasan trivialmente porque el assertion es demasiado débil (`.toBeTruthy()` sobre un número)

**Ubicación:** `__tests__/` o junto al archivo que prueban como `*.test.ts`.

---

## 📋 Tracking de Tareas

### Fase 1 — Fundación del proyecto
- [x] 1.1 Inicializar proyecto Next.js 14 con TypeScript y App Router
- [x] 1.2 Instalar y configurar Tailwind CSS con paleta de colores como CSS variables
- [x] 1.3 Instalar shadcn/ui y configurar tema con la paleta definida
- [x] 1.4 Crear layout base con Sidebar + Header (rutas: dashboard, accounts, transactions, forecast)
- [x] 1.5 Configurar alias de paths en tsconfig (`@/lib`, `@/components`, etc.)

### Fase 2 — Base de datos y adaptador
- [x] 2.1 Definir interface `IDatabase` (adapter pattern) en `lib/db/adapter.ts`
- [x] 2.2 Implementar adaptador SQLite en `lib/db/sqlite.ts`
- [x] 2.3 Crear schema SQL completo en `lib/db/schema.sql` con todas las tablas
- [x] 2.4 Crear script de migración/seed inicial
- [x] 2.5 Crear stub vacío `lib/db/postgres.ts` con TODO para migración futura
- [x] 2.6 Crear `lib/db/index.ts` que exporta el adaptador correcto según env

### Fase 3 — Repositorios y lógica de negocio
- [x] 3.1 Crear `AccountsRepository` (CRUD cuentas crédito, débito, préstamo)
- [x] 3.2 Crear `TransactionsRepository` (CRUD transacciones, query por cuenta y mes)
- [x] 3.3 Crear `IncomeRepository` (CRUD fuentes de ingreso y entradas)
- [x] 3.4 Crear `MsiRepository` (query de installments por mes/cuenta)
- [x] 3.5 Implementar lógica MSI en `lib/utils/msi.ts` (cuota base, residual, expansión)
- [x] 3.6 Implementar lógica de forecast en `lib/utils/forecast.ts`
- [x] 3.7 Implementar formateadores en `lib/utils/formatters.ts` (MXN, fechas)
- [x] 3.8 Implementar lógica de alertas de fechas en `lib/utils/alerts.ts`

### Fase 4 — Pruebas funcionales
- [x] 4.1 Test: lógica MSI — cuota base y residual correcto
- [x] 4.2 Test: lógica MSI — expansión correcta en msi_installments
- [x] 4.3 Test: Capital Fin = Inicio + Ingresos - Gastos
- [x] 4.4 Test: proyección anual y diaria de rendimiento
- [x] 4.5 Test: % utilización de crédito y rangos de color
- [x] 4.6 Test: alertas de fechas (corte, pago, anualidad)
- [x] 4.7 Test: forecast mensual con ingresos variables
- [x] 4.8 Test: repositorios — CRUD básico sobre SQLite en memoria

### Fase 5 — API Routes
- [x] 5.1 `GET/POST /api/accounts`
- [x] 5.2 `GET/PUT/DELETE /api/accounts/[id]`
- [x] 5.3 `GET/POST /api/transactions`
- [x] 5.4 `GET/PUT/DELETE /api/transactions/[id]`
- [x] 5.5 `GET/POST /api/income/sources`
- [x] 5.6 `GET/POST /api/income/entries`
- [x] 5.7 `GET /api/dashboard/flow` — datos Tabla 1 (flujo mensual)
- [x] 5.8 `GET /api/dashboard/breakdown` — datos Tabla 2 (desglose tarjetas)
- [x] 5.9 `GET /api/dashboard/summary` — datos widgets (débito, deuda, alertas)
- [x] 2.4 Crear script de migración/seed inicial

### Fase 6 — Componentes base UI
- [x] 6.1 Componente `DataTable` genérico reutilizable con soporte de colores por celda
- [x] 6.2 Componente `KPICard` para métricas rápidas
- [x] 6.3 Componente `StatusBadge` para alertas y % utilización
- [x] 6.4 Componente `CurrencyCell` con formato MXN
- [x] 6.5 Componente `CollapsibleRow` para años en Tabla 2

### Fase 7 — Dashboard principal `/dashboard`
- [x] 7.1 Tabla 1: Flujo General Mensual con columnas dinámicas de préstamos
- [x] 7.2 Tabla 2: Desglose por Tarjeta (año colapsable, mes resaltado, proyectado en cursiva)
- [x] 7.3 Widget: Cuentas Débito con fila de totales
- [x] 7.4 Widget: Deuda con colores de % utilización
- [x] 7.5 Widget: Tarjetas con alertas visuales de fechas

### Fase 8 — Vista de Cuentas `/accounts` y `/accounts/[id]`
- [x] 8.1 Página `/accounts` — lista separada crédito vs débito con cards
- [x] 8.2 Página `/accounts/[id]` crédito — metadatos (corte, pago, límite, disponible, anualidad)
- [x] 8.3 Página `/accounts/[id]` crédito — tabla gastos mes a mes (real + proyectado)
- [x] 8.4 Página `/accounts/[id]` crédito — sección MSI activos con progreso
- [x] 8.5 Página `/accounts/[id]` débito — metadatos (banco, saldo, rendimiento)
- [x] 8.6 Página `/accounts/[id]` débito — historial de movimientos con subtipo

### Fase 9 — Transacciones `/transactions`
- [x] 9.1 Tabla global de transacciones con todas las cuentas
- [x] 9.2 Filtros: cuenta, categoría, mes, MSI/normal
- [x] 9.3 Formulario `AddTransactionForm` con lógica MSI automática al guardar
- [x] 9.4 Badge MSI en tabla mostrando `cuota X/N meses`

## Regla de entrega

Antes de declarar completado: (1) confirmar que el cambio está en el componente correcto, (2) verificar normalización de UI (sin template literals para clases condicionales, solo CSS vars, `h-8` en inputs), (3) confirmar que compila sin errores.

### Fase 10 — Forecast `/forecast`
- [x] 10.1 Formulario para configurar fuentes de ingreso (nombre, frecuencia, monto base, variable)
- [x] 10.2 Tabla de proyección mensual: ingreso esperado vs compromisos MSI vs gastos promedio
- [x] 10.3 Alerta visual en meses con flujo negativo proyectado
- [x] 10.4 Soporte para actualizar fuentes de ingreso (cambio de nómina, nuevo bono, etc.)

### Fase 11 — Base de calidad

**Convención:** `[ ]` pendiente · `[x]` completado · `![]` decisión descubierta durante implementación

#### 11.0 — Documentación previa (commit)
- [x] 11.0.1 Agregar tracking de Fase 11 al CLAUDE.md
- [x] 11.0.2 Documentar reglas de precisión decimal, timezone, moneda y capa domain en CLAUDE.md

#### 11.1 — Extraer lógica de negocio a `lib/domain/` (commit)
- [x] 11.1.1 Centralizar `roundCents()` en `lib/utils/msi.ts` y eliminar las 3 copias ad-hoc
- [x] 11.1.2 Consolidar `msiElapsed`/`msiRemainingAmount` de OpeningBalanceWizard → `lib/utils/msi.ts`
- [x] 11.1.3 Eliminar doble `expandMsi` en `TransactionsRepository.create()`
- [x] 11.1.4 Crear `lib/domain/types.ts` (FlowRow, LoanColumn, DebitAccountSummary, CreditAccountSummary, MonthSlice)
- [x] 11.1.5 Crear `lib/domain/flow.ts` (`computeFlowRows` + `projectMonthlyIncome` canónico)
- [x] 11.1.6 Crear `lib/domain/yields.ts` (`computeYieldProjection`, `computeDebitSummary`)
- [x] 11.1.7 Crear `lib/domain/credit.ts` (`computeCreditUtilization`, `computeDebtSummary`)
- [x] 11.1.8 Crear `lib/domain/balance.ts` (`balanceDelta`, `computeBalanceDiscrepancy`)
- [x] 11.1.9 Crear `lib/domain/breakdown.ts` (`computeBreakdownMatrix`)
- [x] 11.1.10 Crear `lib/domain/kpis.ts` (`computeTransactionKpis`, `computeAccountKpis`)
- [x] 11.1.11 Crear `lib/domain/account-detail.ts` (`computeEffectiveMonth`, `buildAccountMonthlyRows`, `buildActiveMsiSummary`, `buildBillingCycles`)
- [x] 11.1.12 Crear `lib/domain/index.ts` barrel export
- [x] 11.1.13 Migrar: `dashboard/page.tsx`, `flow/page.tsx`, `breakdown/page.tsx`, `debt/page.tsx`
- [x] 11.1.14 Migrar: `api/dashboard/flow`, `api/dashboard/summary`, `api/dashboard/breakdown`
- [x] 11.1.15 Migrar: `accounts/page.tsx`, `accounts/[id]/page.tsx`, `transactions/page.tsx`
- [x] 11.1.16 Migrar componentes: `AccountMetaDebit`, `MonthlyFlowTable`, `TransactionForm`, `IncomeSourceForm`, `OpeningBalanceWizard`
- [x] 11.1.17 Migrar `transactions.repo.ts` (importar `balanceDelta` de domain)
- [x] 11.1.18 Corregir flujo V1→V3: `dashboard/page.tsx` debe filtrar `income`/`purchase`, no `transfer_*`
- [x] 11.1.19 Verificar: `npx tsc --noEmit` + `npm test` pasan

#### 11.2 — Herramientas de calidad (commit)
- [x] 11.2.1 Migrar Jest → Vitest (instalar vitest, crear vitest.config.ts, eliminar jest/ts-jest)
- [x] 11.2.2 Actualizar imports en tests existentes para Vitest si es necesario
- [x] 11.2.3 Extender `.eslintrc.json` con reglas prácticas
- [x] 11.2.4 Agregar scripts `typecheck` y `check` (tsc + lint + vitest run) en `package.json`
- [x] 11.2.5 Verificar: `npm run check` pasa limpio

#### 11.3 — Tests de funciones de dominio (commit)
- [x] 11.3.1 Crear `__tests__/fixtures/dataset.ts` con datos representativos fijos
- [x] 11.3.2 Test: `domain/flow` (`computeFlowRows` — 5 escenarios reales con SQLite en memoria)
- [x] 11.3.3 Test: `domain/yields` (`computeDebitSummary` — 6 casos)
- [x] 11.3.4 Test: `domain/credit` (`computeCreditUtilization`, `computeDebtSummary` — 8 casos)
- [x] 11.3.5 Test: `domain/balance` (`balanceDelta`, `computeBalanceDiscrepancy` — 11 casos)
- [x] 11.3.6 Test: `domain/kpis` (`computeAccountKpis` — 6 casos)
- [x] 11.3.7 Verificar: `npm run check` pasa con todos los tests nuevos

#### 11.4 — Documentación de arquitectura (commit)
- [x] 11.4.1 Crear `docs/architecture.md` (capas, carpetas, consumidores, convenciones, timezone, decimales)

### Fase 12 — Confirmación de Pagos por Ciclo

**Convención:** `[ ]` pendiente · `[x]` completado · `![]` decisión descubierta durante implementación

#### 12.0 — Documentación previa (commit)
- [x] 12.0.1 Agregar tracking de Fase 12 al CLAUDE.md
- [x] 12.0.2 Documentar reglas de dominio: semántica de `cycle_payments`, status derivado, constraint UNIQUE

#### 12.1 — Data model + domain + repo + API (commit)
- [x] 12.1.1 Agregar tabla `cycle_payments` a `schema.sql`
- [x] 12.1.2 Agregar `CyclePayment` type a `lib/types.ts`
- [x] 12.1.3 Crear `lib/domain/payments.ts` (`computePaymentStatus`, `computeCycleAmountDue`)
- [x] 12.1.4 Crear `lib/repositories/cycle-payments.repo.ts`
- [x] 12.1.5 Crear API routes: `cycle-payments/route.ts` + `cycle-payments/[id]/route.ts`
- [x] 12.1.6 Export desde `lib/domain/index.ts`
- [x] 12.1.7 Tests: `__tests__/domain-payments.test.ts`
- [x] 12.1.8 Verificar: `npm run check`

#### 12.2 — UI: ConfirmPaymentDialog + NextCyclePreview (commit)
- [x] 12.2.1 Crear `ConfirmPaymentDialog.tsx` (FormDialog + SlideToConfirm)
- [x] 12.2.2 Modificar `NextCyclePreview.tsx`: footer con status de pago + botón confirmar
- [x] 12.2.3 Modificar `app/accounts/[id]/page.tsx`: consultar cycle_payments, pasar a BillingCycle
- [x] 12.2.4 Verificar en browser: confirmar pago, pago parcial, deshacer

#### 12.3 — UI: Dashboard indicators (commit)
- [x] 12.3.1 Modificar `AccountMetaCredit.tsx`: "Pago" refleja confirmación
- [x] 12.3.2 Modificar `CardAlertsTable.tsx`: DateRow refleja confirmación
- [x] 12.3.3 Modificar `app/api/dashboard/summary/route.ts`: incluir payment status
- [x] 12.3.4 Modificar `AccountMonthlyTable.tsx`: columna de payment status
- [x] 12.3.5 Verificar en browser: dashboard refleja pagos confirmados
- [x] 12.3.6 Verificar: `npm run check`

### Fase 13 — Confirmación de Ingresos

**Convención:** `[ ]` pendiente · `[x]` completado · `![]` decisión descubierta durante implementación
**Plan completo:** `docs/fase-13-confirmacion-ingresos.md`

#### 13.0 — Documentación previa (commit)
- [x] 13.0.1 Guardar plan en `docs/fase-13-confirmacion-ingresos.md`
- [x] 13.0.2 Agregar tracking de Fase 13 al CLAUDE.md
- [x] 13.0.3 Documentar reglas de dominio: semántica de income confirmation, blending, double-counting fix

#### 13.A — Domain Logic (commit)
- [x] 13.A.1 Crear `lib/domain/income.ts` (`expectedPaymentCount`, `projectMonthlyIncome` canónico, `computeBlendedIncome`, `computeMonthlyNomina`, `computeIncomeConfirmationStatus`)
- [x] 13.A.2 Extender `lib/domain/types.ts` (BlendedIncomeResult, MonthlyNominaResult, IncomeConfirmationStatus, extender FlowRow)
- [x] 13.A.3 Actualizar `lib/domain/index.ts` barrel export

#### 13.B — Bug Fix + Consolidación (commit)
- [x] 13.B.1 Fix `lib/utils/forecast.ts`: custom frequency debe usar `Math.round(30/days)`
- [x] 13.B.2 Eliminar `projectMonthlyIncome` duplicado de `flow/page.tsx`, importar desde domain
- [x] 13.B.3 Fix discrepancia `flow/page.tsx:76`: usar `transfer_out` en vez de `purchase` para transferencias

#### 13.C — Repository (commit)
- [x] 13.C.1 Agregar `findEntriesBySourceAndMonth` a `income.repo.ts`
- [x] 13.C.2 Agregar `deleteEntry` a `income.repo.ts`
- [x] 13.C.3 Agregar `findEntriesByMonthGrouped` a `income.repo.ts`

#### 13.D — API Routes (commit)
- [x] 13.D.1 Crear `app/api/income/entries/[id]/route.ts` (DELETE + PUT)
- [x] 13.D.2 Actualizar `app/api/income/entries/route.ts` (query combinada source_id + month)

#### 13.E — Flow Table Logic (commit)
- [x] 13.E.1 Reescribir `flow/page.tsx` FlowContent: remaining-only para mes actual, blended para futuros
- [x] 13.E.2 Mes actual: abonos/transferencias visual-only (no afectan Ingresos/Gastos Totales)
- [x] 13.E.3 Mes actual: gastos_totales = tarjetas + loans (sin compras débito ya hechas)
- [x] 13.E.4 Actualizar `MonthlyFlowTable.tsx`: badge confirmación en celda Nómina

#### 13.F — Confirmation UI (commit)
- [x] 13.F.1 Crear `ConfirmIncomeDialog.tsx` (mirrors ConfirmPaymentDialog + SlideToConfirm)
- [x] 13.F.2 Crear `IncomeSourceCard.tsx` (card interactiva con progreso de confirmación)
- [x] 13.F.3 Modificar `app/forecast/page.tsx`: usar IncomeSourceCard con status

#### 13.G — Tests (commit)
- [x] 13.G.1 Crear `__tests__/domain-income.test.ts` (blending, projection, confirmation status)
- [x] 13.G.2 Actualizar `__tests__/forecast.test.ts` (custom frequency fix)
- [ ] 13.G.3 Actualizar `__tests__/domain-flow.test.ts` (blended income + current-month semantics)
- [x] 13.G.4 Verificar: `npm run check`

### Fase 14 — Cargos Recurrentes y Transferencias Planificadas

**Convención:** `[ ]` pendiente · `[x]` completado · `![]` decisión descubierta durante implementación
**Plan completo:** `docs/fase-14-cargos-recurrentes-transferencias.md`

#### 14.0 — Documentación previa (commit)
- [x] 14.0.1 Guardar plan en `docs/fase-14-cargos-recurrentes-transferencias.md`
- [x] 14.0.2 Agregar tracking de Fase 14 al CLAUDE.md
- [x] 14.0.3 Documentar reglas de dominio: semántica de recurring_charges, planned_transfers, billing period integration

#### 14.A — Data Model + Types (commit)
- [x] 14.A.1 Agregar tablas `recurring_charges`, `recurring_charge_entries`, `planned_transfers`, `planned_transfer_entries` a `schema.sql`
- [x] 14.A.2 Agregar migraciones aditivas a `lib/db/sqlite.ts`
- [x] 14.A.3 Agregar types a `lib/types.ts` (RecurringCharge, RecurringChargeEntry, PlannedTransfer, PlannedTransferEntry)
- [x] 14.A.4 Agregar domain types a `lib/domain/types.ts` (ChargeBlendedResult, BlendedTransferResult, etc.)
- [x] 14.A.5 Extender TarjetaBreakdown y FlowRow con campos de recurring charges y planned transfers

#### 14.B — Recurring Charges Domain + Repo (commit)
- [x] 14.B.1 Crear `lib/domain/recurring-charges.ts` (chargeIntervalMonths, isChargeExpectedInMonth, computeBlendedCharge, computeMonthlyChargesForAccount, isChargeInBillingPeriod, computeChargeOverdueAlerts)
- [x] 14.B.2 Crear `lib/repositories/recurring-charges.repo.ts`
- [x] 14.B.3 Actualizar `lib/domain/index.ts` barrel export
- [x] 14.B.4 Crear `__tests__/domain-recurring-charges.test.ts`
- [x] 14.B.5 Verificar: `npm run check`

#### 14.C — Planned Transfers Domain + Repo (commit)
- [x] 14.C.1 Crear `lib/domain/planned-transfers.ts` (expectedTransferCount, computeBlendedTransfer, computeMonthlyPlannedTransfers, computeTransferOverdueAlerts)
- [x] 14.C.2 Crear `lib/repositories/planned-transfers.repo.ts`
- [x] 14.C.3 Actualizar `lib/domain/index.ts` barrel export
- [x] 14.C.4 Crear `__tests__/domain-planned-transfers.test.ts`
- [x] 14.C.5 Verificar: `npm run check`

#### 14.D — API Routes (commit)
- [x] 14.D.1 Crear `app/api/recurring-charges/route.ts` (GET/POST)
- [x] 14.D.2 Crear `app/api/recurring-charges/[id]/route.ts` (PUT/DELETE)
- [x] 14.D.3 Crear `app/api/recurring-charges/entries/route.ts` (GET/POST)
- [x] 14.D.4 Crear `app/api/recurring-charges/entries/[id]/route.ts` (PUT/DELETE)
- [x] 14.D.5 Crear `app/api/planned-transfers/route.ts` (GET/POST)
- [x] 14.D.6 Crear `app/api/planned-transfers/[id]/route.ts` (PUT/DELETE)
- [x] 14.D.7 Crear `app/api/planned-transfers/entries/route.ts` (GET/POST)
- [x] 14.D.8 Crear `app/api/planned-transfers/entries/[id]/route.ts` (PUT/DELETE)

#### 14.E — Flow Table Integration (commit) ⚠️ highest risk
- [x] 14.E.1 Modificar `app/dashboard/flow/page.tsx`: integrar recurring charges en cálculo de Tarjetas por tarjeta
- [x] 14.E.2 Modificar `app/dashboard/flow/page.tsx`: integrar planned transfers en Abonos/Transferencias
- [x] 14.E.3 Modificar `components/dashboard/FlowCellBreakdownDialog.tsx`: subsección Suscripciones en per-card breakdown
- [x] 14.E.4 Modificar `components/dashboard/FlowCellBreakdownDialog.tsx`: sección Transferencias planificadas en IngresosContent
- [x] 14.E.5 Verificar: flow table refleja cargos recurrentes y planned transfers correctamente

#### 14.F — NextCyclePreview Integration (commit)
- [x] 14.F.1 Extender `BillingCycle` interface con `recurringItems`
- [x] 14.F.2 Modificar `app/accounts/[id]/page.tsx`: cargar recurring charges, pasar a NextCyclePreview
- [x] 14.F.3 Modificar `components/accounts/NextCyclePreview.tsx`: renderizar recurring charges (confirmado vs proyectado)

#### 14.G — Subscriptions UI (commit)
- [x] 14.G.1 Crear `app/subscriptions/page.tsx` (vista centralizada)
- [x] 14.G.2 Crear `components/subscriptions/RecurringChargeCard.tsx`
- [x] 14.G.3 ~~Crear `components/subscriptions/RecurringChargeDetailDrawer.tsx`~~ — reemplazado por edit/delete inline en la card
- [x] 14.G.4 Crear `components/subscriptions/ConfirmChargeDialog.tsx`
- [x] 14.G.5 Crear `components/subscriptions/RecurringChargeForm.tsx` + `NewRecurringChargeModal.tsx`
- [x] 14.G.6 Crear `components/subscriptions/ChargeOverdueBanner.tsx`
- [x] 14.G.7 Modificar `components/layout/Navbar.tsx`: agregar "Suscripciones" con icono `Repeat`

#### 14.H — Planned Transfers UI (commit)
- [x] 14.H.1 Crear `components/accounts/PlannedTransferCard.tsx`
- [x] 14.H.2 ~~Crear `components/accounts/PlannedTransferDetailDrawer.tsx`~~ — reemplazado por edit/delete inline en la card
- [x] 14.H.3 Crear `components/accounts/ConfirmTransferDialog.tsx`
- [x] 14.H.4 Crear `components/accounts/PlannedTransferForm.tsx` + `NewPlannedTransferModal.tsx`
- [x] 14.H.5 Modificar `app/accounts/[id]/page.tsx`: sección "Transferencias planificadas" para cuentas débito

#### 14.I — Polish + Tests finales (commit)
- [x] 14.I.1 Verificar `npm run check` pasa
- [x] 14.I.2 Test en browser: crear suscripción → confirmar → verificar en flow table y NextCyclePreview
- [x] 14.I.3 Test en browser: crear planned transfer → confirmar → verificar en flow table

### Fase 15 — Préstamos como Ciudadanos de Primera Clase

**Convención:** `[ ]` pendiente · `[x]` completado · `![]` decisión descubierta durante implementación
**Plan completo:** `docs/fase-15-prestamos.md`

#### 15.0 — Documentación previa (commit)
- [x] 15.0.1 Guardar plan en `docs/fase-15-prestamos.md`
- [x] 15.0.2 Agregar tracking de Fase 15 al CLAUDE.md
- [x] 15.0.3 Documentar reglas de dominio en CLAUDE.md (amortización francesa, mid-life onboarding, confirmación de pagos, proyección en flow table)

#### 15.A — Data Model + Types (commit)
- [x] 15.A.1 Agregar 6 columnas a `accounts` en `schema.sql`: `loan_original_amount`, `loan_interest_rate`, `loan_term_months`, `loan_monthly_payment`, `loan_start_date`, `loan_payments_made`
- [x] 15.A.2 Agregar migración aditiva a `lib/db/sqlite.ts`
- [x] 15.A.3 Extender `Account` en `lib/types.ts` con 6 campos opcionales
- [x] 15.A.4 Agregar domain types a `lib/domain/types.ts` (AmortizationRow, LoanProgress, LoanKpis)
- [x] 15.A.5 Extender `CreateAccountInput`, `UpdateAccountInput` y métodos `create()`/`update()` en `accounts.repo.ts`
- [x] 15.A.6 Extender Zod schemas en API routes de accounts

#### 15.B — Domain Logic: `lib/domain/loans.ts` (commit)
- [x] 15.B.1 Crear `lib/domain/loans.ts` (`computeMonthlyPayment`, `computeAmortizationSchedule`, `computeLoanProgress`, `computeEstimatedPayoffDate`, `computeRemainingTerm`, `computeLoanProjectionForMonth`, `computeLoanKpis`)
- [x] 15.B.2 Actualizar `lib/domain/index.ts` barrel export
- [x] 15.B.3 Verificar: `npm run check`

#### 15.C — Tests Domain Logic (commit)
- [x] 15.C.1 Crear `__tests__/domain-loans.test.ts` (amortización, progreso, proyección, edge cases)
- [ ] 15.C.2 Extender `__tests__/fixtures/dataset.ts` con campos de préstamo
- [x] 15.C.3 Verificar: `npm run check`

#### 15.D — AccountForm: Campos de Préstamo (commit)
- [x] 15.D.1 Separar condición `isCredit` en `AccountForm.tsx`: credit vs loan vs debit
- [x] 15.D.2 Agregar sección de campos loan-specific: monto original, tasa, plazo, mensualidad, inicio, pagos hechos
- [x] 15.D.3 Extender Zod schema del form con 6 campos opcionales

#### 15.E — Vista Detalle: AccountMetaLoan + LoanAmortizationTable (commit)
- [x] 15.E.1 Crear `components/accounts/AccountMetaLoan.tsx` (4 KPIs: monto original, saldo, mensualidad, progreso)
- [x] 15.E.2 Crear `components/accounts/LoanAmortizationTable.tsx` (tabla completa: #, mes, pago, capital, interés, saldo, status)
- [x] 15.E.3 Modificar `app/accounts/[id]/page.tsx`: separar `isCredit`/`isLoan`/`isDebit`, renderizar componentes loan-specific
- [ ] 15.E.4 Verificar en browser: KPIs y tabla de amortización renderizan correctamente

#### 15.F — Confirmación de Pagos de Préstamo (commit)
- [x] 15.F.1 Crear `components/accounts/ConfirmLoanPaymentDialog.tsx` (desglose capital/interés, monto editable)
- [x] 15.F.2 Crear `app/api/loans/confirm-payment/route.ts` (transacción atómica: cycle_payment + update balance)
- [ ] 15.F.3 Integrar botón de confirmación en la tabla de amortización (fila actual)
- [ ] 15.F.4 Verificar en browser: confirmar pago → balance actualiza → tabla recalcula

#### 15.G — Flow Table Integration (commit) ⚠️ highest risk
- [x] 15.G.1 Modificar `app/dashboard/flow/page.tsx`: reemplazar `txRepo.sumByAccountAndMonth` para loans con `computeLoanProjectionForMonth`
- [ ] 15.G.2 Modificar `lib/domain/flow.ts`: mismo cambio, agregar `cpRepo` a repos
- [x] 15.G.3 Actualizar seed capital para años futuros (sección lines ~80-95)
- [ ] 15.G.4 Verificar: flow table proyecta préstamos correctamente (pasado/actual/futuro)

#### 15.H — Dashboard Integration (commit)
- [ ] 15.H.1 Modificar `app/dashboard/debt/page.tsx`: sección "Préstamos" con columnas loan-specific (saldo, mensualidad, progreso, tasa)
- [ ] 15.H.2 Modificar `app/dashboard/page.tsx`: separar widget de tarjetas vs préstamos
- [ ] 15.H.3 Extender `lib/domain/kpis.ts`: desglose `totalDeudaTarjetas` + `totalDeudaPrestamos`

#### 15.I — Polish + Tests finales (commit)
- [x] 15.I.1 Verificar `npm run check` pasa
- [ ] 15.I.2 Browser: crear préstamo con todos los campos → form guarda correctamente
- [ ] 15.I.3 Browser: detalle de préstamo → KPIs y tabla de amortización
- [ ] 15.I.4 Browser: confirmar pago → balance actualiza y tabla recalcula
- [ ] 15.I.5 Browser: confirmar pago variable (mayor a mensualidad) → recálculo correcto
- [ ] 15.I.6 Browser: flow table muestra proyecciones de préstamos
- [ ] 15.I.7 Browser: dashboard debt muestra préstamos con columnas apropiadas
- [ ] 15.I.8 Edge case: préstamo con tasa 0%
- [ ] 15.I.9 Edge case: préstamo completamente pagado (balance = 0)
- [x] 15.I.10 Verificar tests existentes no regresan
