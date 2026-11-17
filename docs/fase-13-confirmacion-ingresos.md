# Fase 13 — Confirmación de Ingresos

## Context

Finkhy permite registrar fuentes de ingreso (nómina, freelance) con frecuencia y monto base, y proyecta ese ingreso en la tabla de Flujo General Mensual. Sin embargo:

1. **No hay UI para confirmar ingresos recibidos** — la tabla `income_entries` y el API existen, pero no hay formulario en el frontend
2. **Double-counting en el mes actual** — `capital_inicio = patrimonioActual` ya incluye ingresos recibidos Y transacciones de débito realizadas, pero la tabla suma/resta todo el mes encima
3. **Todo-o-nada por mes** — si hay 1 income entry, ignora la proyección; si hay 0, proyecta todo. No hay blending parcial

**Ejemplo del problema**: Nómina quincenal $10k (2 pagos/mes = $20k). Usuario onboardea habiendo recibido 1 pago. Patrimonio = $100k (incluye $10k del pago ya recibido). Gastos crédito = $10k. Capital Fin actual = $100k + $20k - $10k = $110k (incorrecto — debería ser $100k).

## Decisiones de diseño

| Decisión | Elección |
|----------|----------|
| Columna Nómina mes actual | **Full mensual** ($20k) — indicador visual con status de confirmación |
| Ingresos Totales mes actual | **Solo pendientes** — nómina restante. Capital Fin cuadra visualmente |
| Capital Fin mes actual | `Capital Inicio + Ingresos Pendientes - Gastos Pendientes` |
| Ubicación UI confirmación | **Forecast page** — cards de fuentes de ingreso expandidas con progreso |
| Auto-detección | **NO** — confirmación manual, igual que `cycle_payments` |
| Alcance | **Solo nómina** en Fase 13. Proyecciones recurrentes de abonos/transferencias → Fase 14 (tabla separada `recurring_projections`) |

## Semántica del mes actual (fix double-counting completo)

`patrimonioActual` es un snapshot mid-month. Ya refleja TODOS los movimientos reales que ocurrieron este mes: ingresos recibidos, compras de débito, transferencias. Por lo tanto, para el mes actual:

```
capital_inicio = patrimonioActual (snapshot real)

# Solo lo que FALTA por ocurrir este mes:
remaining_nomina  = pagos de nómina aún no confirmados (de income confirmation)
remaining_abonos  = 0 (no hay proyecciones de abonos aún — Fase 14)
remaining_transfers = 0 (no hay proyecciones de transferencias aún — Fase 14)
tarjetas          = full mes (crédito NO afecta patrimonio débito hasta el pago)
loans             = full mes (igual)

ingresos_totales = remaining_nomina
gastos_totales   = tarjetas + loans
capital_fin      = capital_inicio + ingresos_totales - gastos_totales
```

**Tabla esperada (mes actual, 1 de 2 pagos confirmado, $10k gastos crédito)**:
```
| Cap.Inicio | Nómina  | Abonos | Ing.Tot | Transfers | Tarjetas | Gastos Tot | Cap.Fin  |
|------------|---------|--------|---------|-----------|----------|------------|----------|
| $100,000   | $20,000 | $2,000 | $10,000 | $4,000    | $10,000  | $10,000    | $100,000 |
  (real)      (visual   (visual  (pending  (visual    (obligac.) (obligac.)   ✓ cuadra
               full)     full)    only)     full)
              "1/2 ✓"
```

- **Nómina, Abonos, Transferencias**: muestran valores reales del mes completo (visual/informativo)
- **Ingresos Totales**: solo nómina PENDIENTE (para que Capital Fin cuadre)
- **Gastos Totales**: solo obligaciones de crédito/préstamos (no incluye compras débito ya hechas)
- **Nota**: para meses pasados y futuros, la lógica actual se mantiene (sin patrimonio anchoring)

---

## Implementación

### Fase A — Domain Logic (`lib/domain/income.ts`)

**Crear `lib/domain/income.ts`** con las funciones puras de cálculo:

- `expectedPaymentCount(source)` — deriva de frequency: weekly=4, biweekly=2, monthly=1, custom=round(30/days)
- `projectMonthlyIncome(source)` — versión CANÓNICA (reemplaza las 2 copias duplicadas en `flow/page.tsx` y `forecast.ts`)
- `computeBlendedIncome(source, entries)` — blending por fuente: `{ confirmedTotal, remainingProjected, blendedTotal, confirmedCount, expectedCount }`
- `computeMonthlyNomina(sources, entriesBySource, mode)` — agrega todas las fuentes para un mes
  - `mode = 'full'`: proyección pura (meses pasados sin entries, meses futuros sin entries)
  - `mode = 'blended'`: confirmado + restante (meses futuros con entries parciales)
  - `mode = 'remaining-only'`: solo lo pendiente (mes actual — para cálculo de Ingresos Totales)
  - `mode = 'display'`: proyección completa (mes actual — para columna Nómina visual)
- `computeIncomeConfirmationStatus(source, entries)` — para UI: `{ status: 'confirmed'|'partial'|'pending', confirmedCount, expectedCount, confirmedTotal, remainingAmount }`

**Fórmula de blending por fuente**:
```
expectedCount = expectedPaymentCount(source)
confirmedCount = entries.length
confirmedTotal = sum(entries.amount)
remainingCount = max(0, expectedCount - confirmedCount)
remainingProjected = remainingCount * source.base_amount
blendedTotal = confirmedTotal + remainingProjected
```

**Extender `lib/domain/types.ts`** con tipos nuevos:
- `BlendedIncomeResult`, `MonthlyNominaResult`, `IncomeConfirmationStatus`
- Extender `FlowRow` con: `is_projected?`, `is_partial?`, `nomina_display?`, `nomina_confirmed?`, `nomina_remaining?`

### Fase B — Bug Fix + Consolidación

- **Fix `lib/utils/forecast.ts`**: `custom` frequency retorna solo `base_amount` — debe ser `base_amount * Math.round(30/days)`. Delegar cálculo a `projectMonthlyIncome` canónico de `lib/domain/income.ts`.
- **Eliminar `projectMonthlyIncome` duplicado** de `app/dashboard/flow/page.tsx` — importar desde domain.
- **Fix discrepancia** en `flow/page.tsx:76`: usa `purchase` para transferencias, debería usar `transfer_out` como en `domain/flow.ts:44`.

### Fase C — Repository

**Modificar `lib/repositories/income.repo.ts`**:
- Agregar `findEntriesBySourceAndMonth(sourceId, yearMonth)` — entries por fuente y mes
- Agregar `deleteEntry(id)` — para deshacer confirmaciones
- Agregar `findEntriesByMonthGrouped(yearMonth)` — retorna `Map<sourceId, IncomeEntry[]>` (evita N+1)

### Fase D — API Routes

- **Crear `app/api/income/entries/[id]/route.ts`** — DELETE + PUT (patrón idéntico a `cycle-payments/[id]`)
- **Actualizar `app/api/income/entries/route.ts`** — soportar query combinada `?source_id=X&month=YYYY-MM`

### Fase E — Flow Table Logic

**Reescribir `app/dashboard/flow/page.tsx` `FlowContent`** (reemplazar lógica inline líneas 57-109):

Para cada mes:
1. Obtener entries agrupadas por fuente: `incRepo.findEntriesByMonthGrouped(monthStr)`
2. Determinar modo según el mes:
   - **Mes actual** (`isCurrent && year === currentYear`):
     - `nomina_display` = `computeMonthlyNomina(sources, entries, 'display')` → $20k (visual)
     - `nomina_for_calc` = `computeMonthlyNomina(sources, entries, 'remaining-only')` → $10k (pendiente)
     - `abonos` = real (visual only — no se suma a ingresos_totales)
     - `transferencias` = real (visual only — no se suma a gastos_totales)
     - `ingresos_totales = nomina_for_calc` (solo nómina pendiente)
     - `gastos_totales = tarjetas + loans` (solo obligaciones crédito/préstamos)
     - `capital_inicio = patrimonioActual`
     - `capital_fin = capital_inicio + ingresos_totales - gastos_totales` ✓
   - **Meses futuros** (`isFuture`): modo `'blended'` para nómina, abonos/transferencias = 0 (no hay datos), tarjetas + loans full
   - **Meses pasados**: lógica actual (sin patrimonio anchoring, todo se encadena)
3. Setear `is_projected`, `is_partial` en el FlowRow

**Actualizar `components/dashboard/MonthlyFlowTable.tsx`**:
- Celda Nómina del mes actual muestra el valor `display` ($20k) con badge "1/2 confirmado"
- Meses con `is_partial`: texto normal + badge "Parcial"
- Meses con `is_projected`: italic + opacity (existente)
- Meses fully confirmed: texto normal + icono check

### Fase F — Confirmation UI (Forecast page)

**Crear `components/forecast/ConfirmIncomeDialog.tsx`** — mirrors `ConfirmPaymentDialog`:
- Header charcoal con DollarSign icon + nombre de fuente
- "Monto esperado" display (base_amount, informacional)
- "Monto recibido" Input (pre-filled con base_amount, editable para variables)
- "Fecha" date Input (default: today)
- "Notas" optional Input
- SlideToConfirm: "Desliza para confirmar ingreso · $X,XXX.XX"
- POST a `/api/income/entries`, luego `router.refresh()`

**Crear `components/forecast/IncomeSourceCard.tsx`** — card interactiva por fuente:
- Header: nombre, badge de frecuencia, monto mensual estimado
- Progreso del mes actual: "1/2 pagos confirmados" con dots visuales
- Lista de entries confirmadas (fecha, monto) con botón eliminar
- Botón "Confirmar ingreso" cuando `confirmedCount < expectedCount`
- Indicador "Completo" verde cuando todos confirmados

**Modificar `app/forecast/page.tsx`**:
- Fetch entries del mes actual agrupadas por fuente
- Computar `IncomeConfirmationStatus` por fuente
- Reemplazar cards simples con `IncomeSourceCard`

### Fase G — Tests

**Crear `__tests__/domain-income.test.ts`**:
- `expectedPaymentCount`: todas las frecuencias
- `projectMonthlyIncome`: todas las frecuencias incluyendo custom con days
- `computeBlendedIncome`: sin entries, parcial, completo, overflow (más entries que expected), montos variables
- `computeMonthlyNomina`: múltiples fuentes, todos los modos (full, blended, remaining-only, display)
- `computeIncomeConfirmationStatus`: pending, partial, confirmed

**Actualizar tests existentes**:
- `__tests__/forecast.test.ts`: agregar test de custom frequency fix
- `__tests__/domain-flow.test.ts`: agregar test de blended income en flow rows + test de current-month semantics (remaining-only abonos/transferencias)

---

## Archivos a modificar/crear

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `lib/domain/income.ts` | **CREAR** | Lógica canónica de proyección + blending |
| `lib/domain/types.ts` | MODIFICAR | Tipos nuevos + extender FlowRow |
| `lib/domain/index.ts` | MODIFICAR | Barrel export |
| `lib/utils/forecast.ts` | MODIFICAR | Fix custom frequency, delegar a domain |
| `lib/repositories/income.repo.ts` | MODIFICAR | Nuevos métodos query/delete |
| `app/api/income/entries/[id]/route.ts` | **CREAR** | DELETE + PUT |
| `app/api/income/entries/route.ts` | MODIFICAR | Query combinada source_id + month |
| `app/dashboard/flow/page.tsx` | MODIFICAR | Reescribir: remaining-only para mes actual, fix transfer_out vs purchase |
| `components/dashboard/MonthlyFlowTable.tsx` | MODIFICAR | Badge confirmación en celda Nómina |
| `components/forecast/ConfirmIncomeDialog.tsx` | **CREAR** | Dialog de confirmación (mirrors ConfirmPaymentDialog) |
| `components/forecast/IncomeSourceCard.tsx` | **CREAR** | Card interactiva con progreso |
| `app/forecast/page.tsx` | MODIFICAR | Usar IncomeSourceCard con status |
| `__tests__/domain-income.test.ts` | **CREAR** | Tests de blending |

## Funciones existentes a reutilizar

- `roundCents()` de `lib/utils/msi.ts`
- `formatMXN()`, `formatMonthLabel()` de `lib/utils/formatters.ts`
- `SlideToConfirm` de `components/kokonutui/slide-to-confirm`
- `FormField`, `Input`, `Dialog` de shadcn
- `StatusBadge` de `components/ui/status-badge`
- `computePaymentStatus()` de `lib/domain/payments.ts` — patrón de referencia

## Fase 14 (futura) — Preview

Lo que queda para después:
- **Tabla `recurring_projections`** — operaciones recurrentes de débito (abonos y transferencias proyectados)
- **UI para gestionar proyecciones** — similar a income sources pero para operaciones débito
- **Blending de abonos/transferencias** — confirmación + remaining para abonos y transferencias proyectados
- **Columnas Abonos/Transferencias en meses futuros** — actualmente $0, serán proyectados desde recurring_projections

## Verificación

1. `npx tsc --noEmit` — compila sin errores
2. `npm test` — todos los tests pasan (incluyendo nuevos)
3. Browser: Forecast page muestra cards con progreso de confirmación
4. Browser: Confirmar ingreso → entry se crea, progreso actualiza
5. Browser: Flow table mes actual → Nómina muestra full con badge, Capital Fin cuadra (no double-count)
6. Browser: Eliminar entry → progreso regresa, proyección se ajusta
7. Caso edge: onboard mid-cycle → Capital Fin no double-counts
8. Verificar: abonos y transferencias del mes actual son visual-only, no afectan Capital Fin
