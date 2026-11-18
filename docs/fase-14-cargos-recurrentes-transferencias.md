# Fase 14 — Cargos Recurrentes y Transferencias Planificadas

## Context

Finkhy permite registrar fuentes de ingreso recurrentes y confirmarlas (Fase 13), pero no tiene equivalente para el lado de gastos. Los `flow_adjustments` existentes son one-off por mes y no tienen recurrencia. Esto deja un gap: el usuario no puede ver en el Flujo General Mensual cuanto pagara por Netflix, CFE, o cuanto espera recibir/transferir periodicamente.

La Fase 14 introduce dos features que siguen el patron probado de `income_sources`/`income_entries`: definicion recurrente + confirmacion manual.

**Ejemplo del problema**: Usuario paga Netflix ($250/mes en Amex), CFE ($800/bimestral en BBVA), y transfiere $10,000/mes a cuenta de ahorro. Ninguno de estos se refleja en la proyeccion del Flujo General Mensual. Los meses futuros solo muestran MSI + compras reales, subestimando los gastos.

## Decisiones de diseno

| Decision | Eleccion |
|----------|----------|
| Matching suscripciones vs transacciones reales | **Confirmacion manual** (mismo patron que income confirmation) |
| Ubicacion gestion suscripciones | **Vista centralizada nueva** `/subscriptions` |
| Ubicacion transferencias planificadas | **Asociadas a cuenta debito** (gestionadas desde `/accounts/[id]`) |
| Frecuencias suscripciones | **Por meses** (monthly, bimonthly, quarterly, semiannual, annual, custom) |
| Frecuencias transferencias | **Por dias** (weekly, biweekly, monthly, custom, one_time) — espejo de income_sources |

---

## Feature A: Cargos Recurrentes (Suscripciones/Servicios)

### Que es
Entidades independientes (Netflix, CFE, Spotify) vinculadas a una cuenta (credito o debito). Se proyectan como cargos esperados que alimentan el total de la tarjeta -> columna "Tarjetas" en el flow table. Confirmacion manual cuando el cargo se materializa.

### Modelo de datos

**Tabla `recurring_charges`:**
```sql
CREATE TABLE IF NOT EXISTS recurring_charges (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  account_id             TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  frequency              TEXT NOT NULL CHECK(frequency IN ('monthly','bimonthly','quarterly','semiannual','annual','custom')),
  base_amount            REAL NOT NULL DEFAULT 0,
  is_variable            INTEGER NOT NULL DEFAULT 0,
  is_active              INTEGER NOT NULL DEFAULT 1,
  start_date             TEXT,
  end_date               TEXT,
  custom_interval_months INTEGER,
  category               TEXT,
  notes                  TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Tabla `recurring_charge_entries`:**
```sql
CREATE TABLE IF NOT EXISTS recurring_charge_entries (
  id                  TEXT PRIMARY KEY,
  recurring_charge_id TEXT NOT NULL REFERENCES recurring_charges(id) ON DELETE CASCADE,
  date                TEXT NOT NULL,
  amount              REAL NOT NULL,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Diferencia intencional: frecuencias por meses (no dias). Netflix cobra mensual, CFE bimestral, seguros anual. No hay concepto de "semanal" para suscripciones.

### Domain: `lib/domain/recurring-charges.ts`

Funciones clave:
- `chargeIntervalMonths(charge)` — monthly=1, bimonthly=2, quarterly=3, semiannual=6, annual=12, custom=custom_interval_months
- `isChargeExpectedInMonth(charge, monthStr)` — calcula si el mes cae en un ciclo de cargo, respetando start_date, frequency, y end_date
- `computeBlendedCharge(charge, entries, monthStr)` — `{ confirmed, projected, blended, isConfirmed, isExpected }`
- `computeMonthlyChargesForAccount(charges, entriesByCharge, accountId, monthStr, mode)` — total con modes "full"/"blended"/"remaining-only"
- `computeChargeConfirmationStatus(charge, entries, monthStr)` — `{ status: 'confirmed'|'pending'|'not_expected', amount }`
- `isChargeInBillingPeriod(charge, periodStart, periodEnd)` — para tarjetas de credito que usan billing period en vez de mes calendario
- `computeChargeOverdueAlerts(charges, entriesGrouped, monthStr, today)` — cargos vencidos sin confirmar

### Integracion con Flow Table

En `app/dashboard/flow/page.tsx`, la formula de Tarjetas por tarjeta pasa de:
```
tarjetas += purchases + msi + untracked + flowAdjustment
```
A:
```
tarjetas += purchases + msi + recurringCharges + untracked + flowAdjustment
```

Para tarjetas de credito: `recurringCharges` usa **billing period** (via `isChargeInBillingPeriod`).
Para debito: usa mes calendario.

Temporal:
- **Mes actual**: solo cargos no confirmados (remaining-only)
- **Meses futuros**: blended (confirmados + proyectados)
- **Meses pasados**: solo entries confirmadas

### Integracion con NextCyclePreview

- Cargar `chargeRepo.findByAccount(account.id)` en `app/accounts/[id]/page.tsx`
- Por cada billing cycle, determinar que cargos caen en ese periodo
- Agregar `recurringItems` al `BillingCycle` interface
- Renderizar con icono `Repeat`: confirmado (check verde) vs proyectado (clock, dimmed)
- Total del ciclo: `charges + recurringTotal - credits`

### Integracion con FlowCellBreakdownDialog

En `GastosContent`, dentro del breakdown por tarjeta, subseccion "Suscripciones" despues de MSI/untracked.

---

## Feature B: Transferencias Planificadas

### Que es
Movimientos de dinero esperados asociados a una cuenta debito. Dos direcciones:
- `in`: dinero que espero recibir ("amigo me paga $5,000/mes") -> alimenta Abonos en flow
- `out`: dinero que planeo enviar ("transfiero $10,000 a ahorro/mes") -> alimenta Transferencias en flow

### Modelo de datos

**Tabla `planned_transfers`:**
```sql
CREATE TABLE IF NOT EXISTS planned_transfers (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  account_id            TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  direction             TEXT NOT NULL CHECK(direction IN ('in','out')),
  frequency             TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly','custom','one_time')),
  base_amount           REAL NOT NULL DEFAULT 0,
  is_variable           INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1,
  start_date            TEXT,
  end_date              TEXT,
  custom_interval_days  INTEGER,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Tabla `planned_transfer_entries`:**
```sql
CREATE TABLE IF NOT EXISTS planned_transfer_entries (
  id                   TEXT PRIMARY KEY,
  planned_transfer_id  TEXT NOT NULL REFERENCES planned_transfers(id) ON DELETE CASCADE,
  date                 TEXT NOT NULL,
  amount               REAL NOT NULL,
  notes                TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Frecuencias por dias (espejo de income_sources): weekly=4/mes, biweekly=2/mes, monthly=1/mes, custom=round(30/days). Plus `one_time` para transferencias unicas.

### Domain: `lib/domain/planned-transfers.ts`

Funciones (espejo de `lib/domain/income.ts`):
- `expectedTransferCount(transfer)` — weekly=4, biweekly=2, monthly=1, custom=round(30/days), one_time=1 o 0
- `projectMonthlyTransfer(transfer)` — base_amount * count
- `computeBlendedTransfer(transfer, entries)` — `{ confirmedTotal, remainingProjected, blendedTotal, confirmedCount, expectedCount }`
- `computeMonthlyPlannedTransfers(transfers, entriesByTransfer, mode)` — `{ abonos, transferencias }` separados por direction in/out
- `computeExpectedTransferDates(transfer, monthStr, today, entries)` — slots con timeline
- `computeTransferConfirmationStatus(transfer, entries)` — `{ status, confirmedCount, expectedCount, confirmedTotal, remainingAmount }`
- `computeTransferOverdueAlerts(...)` — alertas de transferencias vencidas

### Integracion con Flow Table

Despues del calculo existente de abonos/transferencias desde transacciones reales:
- `abonos += plannedTransfersIn` (direction='in')
- `transferencias += plannedTransfersOut` (direction='out')

Temporal (mismo patron):
- **Mes actual**: remaining-only
- **Meses futuros**: blended
- **Meses pasados**: solo entries confirmadas

### Integracion con FlowCellBreakdownDialog

- `IngresosContent`: seccion "Transferencias planificadas (entrantes)" con slots de confirmacion
- Transferencias salientes: mostrar en seccion informativa

---

## Repository Layer

### `lib/repositories/recurring-charges.repo.ts`
Patron de `income.repo.ts`:
- `findAll(activeOnly)`, `findById`, `findByAccount(accountId, activeOnly)`
- `createCharge`, `updateCharge`
- `findEntriesByMonth`, `findEntriesByChargeAndMonth`, `findEntriesByMonthGrouped`
- `findEntriesByAccountAndPeriod(accountId, periodStart, periodEnd)` — para billing period
- `createEntry`, `deleteEntry`

### `lib/repositories/planned-transfers.repo.ts`
- `findAll(activeOnly)`, `findById`, `findByAccount(accountId, activeOnly)`, `findByDirection(dir)`
- `createTransfer`, `updateTransfer`
- `findEntriesByMonth`, `findEntriesByTransferAndMonth`, `findEntriesByMonthGrouped`
- `createEntry`, `deleteEntry`

---

## API Routes

### Recurring Charges
- `GET/POST /api/recurring-charges` — listar/crear
- `PUT/DELETE /api/recurring-charges/[id]` — actualizar/eliminar
- `GET/POST /api/recurring-charges/entries` — listar entries / confirmar
- `PUT/DELETE /api/recurring-charges/entries/[id]` — actualizar/eliminar confirmacion

### Planned Transfers
- `GET/POST /api/planned-transfers` — listar/crear
- `PUT/DELETE /api/planned-transfers/[id]` — actualizar/eliminar
- `GET/POST /api/planned-transfers/entries` — listar/confirmar
- `PUT/DELETE /api/planned-transfers/entries/[id]` — actualizar/eliminar

---

## UI Components

### `/subscriptions` page (nueva ruta)
Sigue el patron de `/income/page.tsx`:
- Header "Suscripciones y Servicios"
- Banner de cargos vencidos no confirmados (`ChargeOverdueBanner`)
- Lista de `RecurringChargeCard` agrupadas por cuenta
- Boton "Nueva suscripcion" (`NewRecurringChargeModal`)

Componentes nuevos en `components/subscriptions/`:
- `RecurringChargeCard.tsx` — espejo de `IncomeSourceCard`
- `RecurringChargeDetailDrawer.tsx` — espejo de `IncomeSourceDetailDrawer`
- `ConfirmChargeDialog.tsx` — espejo de `ConfirmIncomeDialog`
- `RecurringChargeForm.tsx` — nombre, cuenta, frecuencia, monto, categoria, start_date
- `NewRecurringChargeModal.tsx` — FormDialog wrapper
- `ChargeOverdueBanner.tsx` — espejo de `IncomeOverdueBanner`

### Planned Transfers en `/accounts/[id]` (solo debito)
Nueva seccion entre `AccountMetaDebit` y tabla mes a mes:
- Header "Transferencias planificadas" con icono `ArrowUpDown`
- Lista de `PlannedTransferCard` para esa cuenta
- Boton "Nueva transferencia planificada"

Componentes nuevos en `components/accounts/`:
- `PlannedTransferCard.tsx`
- `PlannedTransferDetailDrawer.tsx`
- `ConfirmTransferDialog.tsx`
- `PlannedTransferForm.tsx`
- `NewPlannedTransferModal.tsx`

### Navbar
Agregar "Suscripciones" con icono `Repeat` entre "Ingresos" y "Pronostico".

---

## Archivos a modificar/crear

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `lib/db/schema.sql` | MODIFICAR | 4 tablas nuevas con indices |
| `lib/db/sqlite.ts` | MODIFICAR | Migraciones aditivas |
| `lib/types.ts` | MODIFICAR | Interfaces nuevas |
| `lib/domain/types.ts` | MODIFICAR | Tipos dominio nuevos, extender TarjetaBreakdown y FlowRow |
| `lib/domain/recurring-charges.ts` | **CREAR** | Logica de cargos recurrentes |
| `lib/domain/planned-transfers.ts` | **CREAR** | Logica de transferencias planificadas |
| `lib/domain/index.ts` | MODIFICAR | Barrel exports |
| `lib/repositories/recurring-charges.repo.ts` | **CREAR** | CRUD + queries |
| `lib/repositories/planned-transfers.repo.ts` | **CREAR** | CRUD + queries |
| `app/api/recurring-charges/route.ts` | **CREAR** | GET/POST |
| `app/api/recurring-charges/[id]/route.ts` | **CREAR** | PUT/DELETE |
| `app/api/recurring-charges/entries/route.ts` | **CREAR** | GET/POST |
| `app/api/recurring-charges/entries/[id]/route.ts` | **CREAR** | PUT/DELETE |
| `app/api/planned-transfers/route.ts` | **CREAR** | GET/POST |
| `app/api/planned-transfers/[id]/route.ts` | **CREAR** | PUT/DELETE |
| `app/api/planned-transfers/entries/route.ts` | **CREAR** | GET/POST |
| `app/api/planned-transfers/entries/[id]/route.ts` | **CREAR** | PUT/DELETE |
| `app/dashboard/flow/page.tsx` | MODIFICAR | Integrar ambas features en calculo de flujo |
| `components/dashboard/FlowCellBreakdownDialog.tsx` | MODIFICAR | Secciones nuevas en breakdown |
| `components/accounts/NextCyclePreview.tsx` | MODIFICAR | Renderizar recurring charges |
| `app/accounts/[id]/page.tsx` | MODIFICAR | Cargar charges + seccion planned transfers |
| `app/subscriptions/page.tsx` | **CREAR** | Vista centralizada suscripciones |
| `components/subscriptions/*.tsx` | **CREAR** | 6 componentes |
| `components/accounts/PlannedTransfer*.tsx` | **CREAR** | 5 componentes |
| `components/layout/Navbar.tsx` | MODIFICAR | Agregar nav item |
| `__tests__/domain-recurring-charges.test.ts` | **CREAR** | Tests domain |
| `__tests__/domain-planned-transfers.test.ts` | **CREAR** | Tests domain |

## Funciones existentes a reutilizar

- `roundCents()` de `lib/utils/msi.ts`
- `formatMXN()`, `formatMonthLabel()` de `lib/utils/formatters.ts`
- `computeBillingPeriod()` de `lib/utils/billing.ts`
- `SlideToConfirm` de `components/kokonutui/slide-to-confirm`
- `FormField`, `FormActions`, `FormDialog`, `Input`, `Label` de shadcn
- `StatusBadge` de `components/ui/status-badge`
- `computeIncomeConfirmationStatus()` patron de referencia en `lib/domain/income.ts`
- `computeExpectedPaymentDates()` patron de referencia para timeline

## Verificacion

1. `npx tsc --noEmit` — compila sin errores
2. `npm run check` — todos los tests pasan
3. Browser: Crear suscripcion en /subscriptions -> aparece en NextCyclePreview -> suma en Tarjetas del flow
4. Browser: Confirmar cargo -> pasa de "proyectado" a "confirmado"
5. Browser: Mover suscripcion a otra tarjeta -> refleja en nueva tarjeta
6. Browser: Cancelar suscripcion -> deja de proyectarse
7. Browser: Crear planned transfer (in) en cuenta debito -> aparece en Abonos del flow
8. Browser: Crear planned transfer (out) -> aparece en Transferencias del flow
9. Browser: Confirmar transfer -> remaining se reduce, Capital Fin se ajusta
