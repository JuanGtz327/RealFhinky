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

**Para el histórico detallado de TODAS las fases (1–15) y sus tareas, ver [PROGRESS.md](./PROGRESS.md).**

Las Fases 1–15 están 100% completadas. Consulta PROGRESS.md para:
- Resumen ejecutivo de cada fase
- Checklist completo de subtareas por fase
- Referencias a documentos de plan (`docs/fase-N-*.md`)

### Próximas Fases / Backlog

_Pendiente de definir Fase 16 en adelante._
