# Fase 15 — Préstamos como Ciudadanos de Primera Clase

## Context

Los préstamos (`type=loan`) actualmente reusan la infraestructura de tarjetas de crédito sin diferenciación: mismos campos, misma UI (AccountMetaCredit, NextCyclePreview, MSI), y sin lógica de amortización, tasa de interés, ni proyección a futuro. En el flow table, las columnas de préstamos solo suman transacciones reales — los meses futuros aparecen en $0.

**Objetivo**: Convertir préstamos en instrumentos financieros propios con tabla de amortización (capital vs intereses), pagos variables, onboarding a medias, y proyecciones correctas en el flow table.

**Decisiones del usuario**:
1. Tabla de amortización completa con desglose capital/intereses
2. Sin página `/loans` dedicada — vista mejorada en `/accounts/[id]`
3. Pagos variables permitidos (el usuario puede pagar más o menos que la mensualidad fija)

---

## 15.0 — Documentación previa (commit)

- 15.0.1: Guardar plan en `docs/fase-15-prestamos.md`
- 15.0.2: Agregar tracking de Fase 15 al CLAUDE.md
- 15.0.3: Documentar reglas de dominio en CLAUDE.md (amortización francesa, mid-life onboarding, confirmación de pagos, recálculo con pagos variables, proyección en flow table)

---

## 15.A — Data Model + Types (commit)

**6 columnas nuevas en `accounts`** (solo aplican cuando `type=loan`):

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `loan_original_amount` | REAL | Monto original del préstamo |
| `loan_interest_rate` | REAL | Tasa de interés anual (%) |
| `loan_term_months` | INTEGER | Plazo total en meses |
| `loan_monthly_payment` | REAL | Mensualidad estándar (calculable o manual) |
| `loan_start_date` | TEXT | Fecha real de inicio (puede ser años antes del onboarding) |
| `loan_payments_made` | INTEGER | Pagos ya realizados al momento de onboardear |

**Archivos a modificar**:

- `lib/db/schema.sql` — agregar 6 columnas a `accounts`
- `lib/db/sqlite.ts` — migración aditiva (patrón existente: check pragma + ALTER TABLE)
- `lib/types.ts` — extender `Account` con 6 campos opcionales
- `lib/domain/types.ts` — nuevos tipos:
  ```typescript
  AmortizationRow { month, paymentNumber, payment, principal, interest,
                    remainingBalance, isActual, isPast, isCurrent, actualPayment? }
  LoanProgress { paymentsMade, totalPayments, percentComplete,
                 remainingMonths, estimatedPayoffDate }
  LoanKpis { originalAmount, currentBalance, monthlyPayment, interestRate,
             progress, totalInterestPaid, totalInterestProjected }
  ```
- `lib/repositories/accounts.repo.ts` — extender `CreateAccountInput`, `UpdateAccountInput`, y los métodos `create()`/`update()` con los 6 campos
- `app/api/accounts/route.ts` + `app/api/accounts/[id]/route.ts` — extender Zod schemas

---

## 15.B — Domain Logic: `lib/domain/loans.ts` (commit)

Nuevo archivo con funciones puras de amortización:

```typescript
// Fórmula francesa: M = P × [r(1+r)^n] / [(1+r)^n - 1]
// Para tasa 0%: M = P / n
computeMonthlyPayment(principal, annualRate, termMonths): number

// Genera tabla completa desde loan_start_date hasta fin de plazo.
// Pre-Finkhy (loan_payments_made): filas teóricas marcadas isActual=false
// Post-onboarding: usa cycle_payments reales cuando existen
// Pagos variables: si un pago real difiere del estándar, recalcula todo
// el resto de la tabla desde el nuevo saldo
computeAmortizationSchedule(account, cyclePayments[], currentMonth): AmortizationRow[]

// Progreso: paymentsMade = loan_payments_made + cyclePayments.length
computeLoanProgress(account, cyclePayments[]): LoanProgress

// Basado en current_balance, mensualidad y tasa, iterativo hasta saldo = 0
computeEstimatedPayoffDate(currentBalance, monthlyPayment, annualRate, fromMonth): string
computeRemainingTerm(currentBalance, monthlyPayment, annualRate): number

// Para flow table — semántica temporal:
//   Pasado: monto confirmado de cycle_payments (0 si no confirmado)
//   Actual: mensualidad estándar si no confirmado, 0 si ya confirmado
//   Futuro: mensualidad estándar si aún dentro del plazo, 0 si ya terminó
computeLoanProjectionForMonth(account, monthStr, currentMonth, cyclePayment?): number

// KPIs para la vista de detalle
computeLoanKpis(account, cyclePayments[]): LoanKpis
```

Actualizar `lib/domain/index.ts` barrel export.

---

## 15.C — Tests Domain Logic (commit)

Nuevo archivo: `__tests__/domain-loans.test.ts`

**Casos de prueba**:
- `computeMonthlyPayment`: valor conocido ($150k @ 12% × 48m ≈ $3,950.76), tasa 0%, plazo 1 mes
- `computeAmortizationSchedule`: primera fila interés = saldo × tasa_mensual, última fila saldo = 0, con pago variable en mes 3 recalcula el resto, mid-life onboarding con `payments_made=24`
- `computeLoanProgress`: sin pagos, todos los pagos completados
- `computeEstimatedPayoffDate`: caso estándar, con ritmo acelerado (termina antes)
- `computeRemainingTerm`: caso estándar, saldo 0 retorna 0, pago menor que interés mensual (guard)
- `computeLoanProjectionForMonth`: pasado confirmado, pasado sin confirmar, actual confirmado, actual sin confirmar, futuro dentro del plazo, futuro después del plazo

Extender `__tests__/fixtures/dataset.ts` con campos de préstamo en `loan-1`.

---

## 15.D — AccountForm: Campos de Préstamo (commit)

**Archivo**: `components/accounts/AccountForm.tsx`

Cambio clave: separar la condición `isCredit` actual (que agrupa credit + loan) en tres ramas:

```
type === "credit" → campos de tarjeta (límite, corte, pago, anualidad)
type === "loan"   → campos de préstamo (monto original, tasa, plazo, mensualidad, inicio, pagos hechos)
type === "debit" || "investment" → campos de débito (rendimiento)
```

Campos de préstamo en el form:
- Monto original del préstamo (obligatorio)
- Tasa de interés anual % (obligatorio)
- Plazo total en meses (obligatorio)
- Mensualidad — con botón "Calcular" que invoca `computeMonthlyPayment()` client-side
- Fecha de inicio del préstamo
- Pagos ya realizados (para onboarding a medias)
- Día de pago mensual (reusar `payment_due_date` existente)
- Saldo actual (reusar `current_balance`, label: "Deuda pendiente")

Extender Zod schema con los 6 campos opcionales.

---

## 15.E — Vista Detalle: AccountMetaLoan + LoanAmortizationTable (commit)

### Nuevo: `components/accounts/AccountMetaLoan.tsx`

Grid de 4 KPI cards (misma estructura que AccountMetaCredit/AccountMetaDebit):
1. **Monto Original** — `formatMXN(loan_original_amount)`
2. **Saldo Actual** — `formatMXN(current_balance)` + barra de progreso (% pagado)
3. **Mensualidad** — `formatMXN(loan_monthly_payment)` + día de pago
4. **Progreso** — "X/Y pagos" + tasa de interés + fecha estimada de liquidación

### Nuevo: `components/accounts/LoanAmortizationTable.tsx`

Tabla usando `DataTable` con columnas: #, Mes, Pago, Capital, Interés, Saldo Restante, Status.
- Filas pasadas con pago real: check verde (de cycle_payments)
- Filas pasadas sin confirmar: pendiente gris
- Fila actual: resaltada con accent (patrón row-highlight-current)
- Filas futuras: cursiva/dimmed
- Si un pago real difiere del estándar: mostrar delta indicator
- Footer con totales: capital total pagado, interés total, monto total

### Modificar: `app/accounts/[id]/page.tsx`

Cambio crítico — separar las tres ramas:
```typescript
const isCredit = account.type === "credit";
const isLoan   = account.type === "loan";
const isDebit  = account.type === "debit" || account.type === "investment";
```

Cuando `isLoan`:
- Cargar cycle_payments del préstamo
- Computar amortización: `computeAmortizationSchedule(account, cyclePayments, currentMonth)`
- Computar progreso: `computeLoanProgress(account, cyclePayments)`
- Renderizar `AccountMetaLoan` (en vez de AccountMetaCredit)
- Renderizar `LoanAmortizationTable` (en vez de MSI/NextCyclePreview)
- Mantener sección "Transacciones recientes"
- **Eliminar** para loans: OpeningBalanceWizard, MsiActiveList, NextCyclePreview, recurring charges section

**Nota**: `isCredit` ya no incluye loans → revisar que las secciones de billing cycles, recurring charges, etc. sigan funcionando solo para `type=credit`.

---

## 15.F — Confirmación de Pagos de Préstamo (commit)

### Nuevo: `components/accounts/ConfirmLoanPaymentDialog.tsx`

Similar a `ConfirmPaymentDialog` pero con desglose capital/intereses:
- Línea: "Interés: $X" (= currentBalance × tasaMensual)
- Línea: "A capital: $Y" (= pago − interés)
- Línea: "Saldo restante después: $Z"
- Campo monto pre-llenado con `loan_monthly_payment` pero editable (pagos variables)
- Fecha de pago

### Nuevo: `app/api/loans/confirm-payment/route.ts`

Endpoint dedicado que envuelve ambas operaciones en una transacción DB:
1. Fetch account → obtener `current_balance`, `loan_interest_rate`, `loan_monthly_payment`
2. Calcular: `interestPortion = currentBalance × (annualRate / 100 / 12)`
3. Calcular: `principalPortion = amountPaid − interestPortion`
4. En `db.transaction()`:
   - Upsert `cycle_payment` (amount_due = loan_monthly_payment, amount_paid = lo que pagó)
   - Update `accounts.current_balance -= principalPortion`
5. Retornar account actualizado + cycle_payment

**Razón del endpoint dedicado**: la confirmación de pago de un préstamo DEBE actualizar el `current_balance` atómicamente (a diferencia de tarjetas donde el balance se gestiona aparte). Dos llamadas API separadas arriesgan inconsistencia.

### Modificar: `app/accounts/[id]/page.tsx`

- Agregar botón de confirmación de pago en la fila actual de la tabla de amortización
- Usar `ConfirmLoanPaymentDialog` en vez del genérico

---

## 15.G — Flow Table Integration (commit) ⚠️ HIGHEST RISK

### Modificar: `app/dashboard/flow/page.tsx` (líneas 253-257)

**Antes** (solo suma transacciones reales — futuro = $0):
```typescript
const loans = loanAccounts.map((acc) => ({
  account_id: acc.id, name: acc.name,
  amount: txRepo.sumByAccountAndMonth(acc.id, monthStr),
}));
```

**Después** (usa proyección con semántica temporal):
```typescript
const loans = loanAccounts.map((acc) => {
  const cp = cpRepo.findByAccountAndMonth(acc.id, monthStr);
  const amount = computeLoanProjectionForMonth(acc, monthStr, CURRENT_MONTH, cp);
  return { account_id: acc.id, name: acc.name, amount };
});
```

Cambios necesarios:
- Importar `computeLoanProjectionForMonth` de `@/lib/domain/loans`
- El `cpRepo` ya está instanciado en la página pero no se usa para loans — conectarlo
- Aplicar el mismo cambio en la sección de seed capital para años futuros (líneas ~80-95)

### Modificar: `lib/domain/flow.ts` (`computeFlowRows`)

Mismo patrón: reemplazar `txRepo.sumByAccountAndMonth` para loans con `computeLoanProjectionForMonth`. Agregar `cpRepo` al objeto `repos`.

### `MonthlyFlowTable.tsx`

Sin cambios estructurales — las columnas dinámicas de préstamos ya funcionan. Los montos proyectados aparecerán automáticamente en cursiva (patrón `is_projected` existente).

---

## 15.H — Dashboard Integration (commit)

### Modificar: `app/dashboard/debt/page.tsx`

La sección "Préstamos" actualmente usa `DebtTable` que muestra utilización de crédito — no tiene sentido para préstamos. Crear tabla loan-specific con columnas: Préstamo, Banco, Saldo, Mensualidad, Progreso (%), Tasa.

Opción: componente nuevo `LoanDebtTable.tsx` o prop `variant="loan"` en el existente.

### Modificar: `app/dashboard/page.tsx`

Actualmente línea 62: `computeDebtSummary([...creditAccounts, ...loanAccounts])` mezcla todo bajo "Tarjetas de Crédito". Separar para que:
- Widget "Tarjetas de Crédito" muestre solo `type=credit`
- Widget/sección "Préstamos" muestre `type=loan` con info relevante (saldo, mensualidad, progreso)

### Modificar: `lib/domain/kpis.ts`

`computeAccountKpis` ya agrupa loans con credit para `totalDeuda` — esto es correcto. El KPI total de deuda debe incluir ambos. Pero agregar un desglose: `totalDeudaTarjetas` + `totalDeudaPrestamos`.

---

## 15.I — Polish + Tests finales (commit)

- 15.I.1: Verificar `npm run check` (tsc + lint + vitest)
- 15.I.2: Browser: crear préstamo con todos los campos → verificar form guarda correctamente
- 15.I.3: Browser: ver detalle de préstamo → verificar KPIs y tabla de amortización
- 15.I.4: Browser: confirmar pago de préstamo → verificar que balance se actualiza y tabla recalcula
- 15.I.5: Browser: confirmar pago variable (mayor a mensualidad) → verificar recálculo
- 15.I.6: Browser: flow table muestra proyecciones de préstamos correctamente (pasado/actual/futuro)
- 15.I.7: Browser: dashboard debt muestra préstamos con columnas apropiadas
- 15.I.8: Edge case: préstamo con tasa 0% (préstamo familiar)
- 15.I.9: Edge case: préstamo completamente pagado (balance = 0)
- 15.I.10: Verificar tests existentes no regresan (flow table, balance, credit)

---

## Archivos críticos

| Archivo | Acción | Riesgo |
|---------|--------|--------|
| `lib/domain/loans.ts` | **NUEVO** — corazón de la amortización | Bajo (función pura, bien testeada) |
| `app/accounts/[id]/page.tsx` | Separar credit/loan, agregar loan view | Medio (muchas ramas) |
| `components/accounts/AccountForm.tsx` | Campos loan-specific | Bajo |
| `app/dashboard/flow/page.tsx` | Proyección de préstamos | **Alto** (flow central) |
| `lib/domain/flow.ts` | Mismo cambio de proyección | Medio |
| `components/accounts/AccountMetaLoan.tsx` | **NUEVO** | Bajo |
| `components/accounts/LoanAmortizationTable.tsx` | **NUEVO** | Bajo |
| `components/accounts/ConfirmLoanPaymentDialog.tsx` | **NUEVO** | Bajo |
| `app/api/loans/confirm-payment/route.ts` | **NUEVO** — transacción atómica | Medio |

## Verificación

1. `npm run check` (tsc + lint + vitest) debe pasar en cada commit
2. Tests unitarios en `__tests__/domain-loans.test.ts` cubren toda la lógica de amortización
3. Tests en browser cubren el golden path completo: crear préstamo → ver amortización → confirmar pagos → verificar flow table
4. Edge cases: tasa 0%, préstamo pagado, onboarding a medias, pago variable mayor/menor que mensualidad
