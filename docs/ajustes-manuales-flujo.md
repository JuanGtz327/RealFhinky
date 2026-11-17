# Ajustes Manuales de Flujo

## Contexto y problema

Cuando un usuario hace onboarding en Finkhy a mitad de año, la tabla de Flujo General Mensual mezcla datos de distintas fuentes:

- **Capital Inicio** del mes actual se ancla a `patrimonioActual` (suma de saldos reales de cuentas débito) — dato **real**.
- **Tarjetas / Gastos** se calculan solo desde transacciones rastreadas en Finkhy — dato **parcial**.

Esto produce un Capital Fin inflado: Finkhy no sabe de deuda pre-onboarding, tarjetas ya liquidadas, ni ingresos externos no rastreados. Un usuario que compare contra su Excel verá un número distinto, no por error de cálculo sino por diferencia de datos.

## Tres mecanismos de ajuste

### 1. Deuda no rastreada automática (`computeUntrackedDebt`)

**Cuándo aplica**: la tarjeta tiene `current_balance` mayor a lo que Finkhy puede explicar con sus transacciones.

**Cómo funciona**: se deriva dinámicamente:
```
untracked = current_balance − (directDebt + pendingMsiTotal)
```
- `directDebt` = suma de compras no-MSI − pagos `transfer_in` (todas las transacciones de la cuenta)
- `pendingMsiTotal` = cuotas MSI pendientes desde `effectiveMonth` en adelante

Si el resultado es positivo, se suma automáticamente a la columna Tarjetas del mes actual. No requiere input del usuario ni toca la reconciliación de saldo (escudo verde).

**Archivo**: `lib/domain/flow-adjustment.ts` → `computeUntrackedDebt(account, allTransactions, pendingMsiTotal)`

---

### 2. Ajuste manual por tarjeta (`flow_adjustment`)

**Cuándo aplica**: el usuario sabe que tenía deuda pre-onboarding en una tarjeta específica que no se captura con el mecanismo automático (ej. sus transacciones ya cuadran a $9,679 pero su Excel tenía $33,258).

**Cómo funciona**: campo `flow_adjustment REAL` en la tabla `accounts`. Solo aplica al mes actual en el flujo. Se edita inline desde el drill-down de Gastos Totales → sección Tarjetas de Crédito → campo "Ajuste manual" por tarjeta.

Guardado: `PUT /api/accounts/[id]` con `{ flow_adjustment: number | null }`.

**No afecta**: reconciliación de saldo (`computeBalanceDiscrepancy`) — ese cálculo usa `opening_balance_carryover`, no `flow_adjustment`.

---

### 3. Otros Gastos / Otros Ingresos (`flow_adjustments`)

**Cuándo aplica**: gastos o ingresos que no corresponden a ninguna cuenta en Finkhy. Ejemplos:
- Tarjetas cerradas/liquidadas antes del onboarding
- Pagos en efectivo
- Ingresos freelance, ventas, etc. no configurados como fuente de ingreso

**Cómo funciona**: tabla `flow_adjustments` con `(month, type, description, amount)`. Múltiples registros por mes. Se gestionan inline desde los dialogs de Ingresos Totales y Gastos Totales.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | TEXT PK | UUID |
| `month` | TEXT | YYYY-MM |
| `type` | TEXT | `'expense'` o `'income'` |
| `description` | TEXT | Texto libre (max 100 chars) |
| `amount` | REAL | Positivo |

API:
- `GET /api/flow-adjustments?month=YYYY-MM` — listar por mes
- `POST /api/flow-adjustments` — crear (body: `{ month, type, description, amount }`)
- `DELETE /api/flow-adjustments/[id]` — eliminar

Los ajustes de tipo `expense` suman a `gastos_totales`; los de tipo `income` suman a `ingresos_totales`. Aplican a cualquier mes (no solo el actual) por lo que también sirven para corregir meses pasados.

---

## Indicadores visuales en la tabla de flujo

| Icono | Columna | Color | Significado |
|---|---|---|---|
| `Flag` | Mes | Naranja (accent) | Mes de inicio en Finkhy (primer account creado) |
| `CheckCircle2` | Nómina | Verde (success) | N pagos de nómina confirmados este mes |
| `SlidersHorizontal` | Ingresos Totales | Verde (success) | Incluye ajustes manuales de ingreso |
| `SlidersHorizontal` | Gastos Totales | Amarillo (warning) | Incluye ajustes manuales de gasto |

Todos los iconos tienen tooltip al hacer hover. Implementados en `components/dashboard/MonthlyFlowTable.tsx` → `IconTooltip`.

El mes de onboarding se detecta como el mes del `created_at` más antiguo en la tabla `accounts`.

---

## Fórmula del mes actual con ajustes

```
Capital Fin = patrimonioActual
            + nómina_restante
            + otrosIngresosTotal          ← flow_adjustments type='income'
            − tarjetas                   ← purchases + MSI + untracked + flow_adjustment
            − préstamos
            − otrosGastosTotal           ← flow_adjustments type='expense'
```

Los meses pasados y futuros incluyen `otrosIngresosTotal` y `otrosGastosTotal` en sus respectivos totales, pero no aplican `untracked` ni `flow_adjustment` (esos son exclusivos del mes actual).

---

## Archivos clave

| Archivo | Rol |
|---|---|
| `lib/domain/flow-adjustment.ts` | `computeUntrackedDebt()` |
| `lib/repositories/flow-adjustments.repo.ts` | CRUD de `flow_adjustments` |
| `app/api/flow-adjustments/route.ts` | GET + POST |
| `app/api/flow-adjustments/[id]/route.ts` | DELETE |
| `app/dashboard/flow/page.tsx` | Orquesta todos los ajustes en el loop de meses |
| `components/dashboard/FlowCellBreakdownDialog.tsx` | UI de edición inline (Gastos + Ingresos) |
| `components/dashboard/MonthlyFlowTable.tsx` | Iconos indicadores + `IconTooltip` |
