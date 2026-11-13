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
  - Cuota base = `floor(total / meses)`
  - Residual = `total - (cuota_base * meses)` → se suma al último mes
- **Transferencias entre cuentas propias**: No cuentan como gasto ni ingreso en el dashboard global (evitar double-count)
- **Columnas de préstamos**: Dinámicas — se genera una columna por cada cuenta `type=loan` activa
- **Capital Fin Mes**: `Capital Inicio + Ingresos Totales - Gastos Totales`
- **Proyección Anual débito**: `Capital × (yield_rate / 100)`
- **Proyección Diaria débito**: `Proyección Anual / 365`
- **% Utilización crédito**: Verde <30%, Amarillo 30-70%, Rojo >70%
- **Moneda**: Solo MXN, formato `$#,###.00`

## Estructura de rutas
```
/                        → redirect a /dashboard
/dashboard               → vista general (5 secciones)
/accounts                → lista de todas las cuentas
/accounts/[id]           → detalle de cuenta (crédito o débito)
/transactions            → todas las transacciones (global)
/forecast                → pronósticos de flujo de caja
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
- Currently installed: `empty-state`, `promise-toast`, `slide-to-confirm`
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

### Componentes Kokonut UI instalados
- `empty-state` — empty states con animación de entrada
- `promise-toast` — sistema de toasts (provider + hook `useToast`)
- `slide-to-confirm` — confirmación de acciones destructivas

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
- [ ] 2.4 Crear script de migración/seed inicial
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

### Fase 10 — Forecast `/forecast`
- [x] 10.1 Formulario para configurar fuentes de ingreso (nombre, frecuencia, monto base, variable)
- [x] 10.2 Tabla de proyección mensual: ingreso esperado vs compromisos MSI vs gastos promedio
- [x] 10.3 Alerta visual en meses con flujo negativo proyectado
- [x] 10.4 Soporte para actualizar fuentes de ingreso (cambio de nómina, nuevo bono, etc.)
