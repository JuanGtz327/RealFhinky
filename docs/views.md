# Documentación por Vista

## Flujo General Mensual (`/dashboard/flow`)

**Archivos clave:**
- `app/dashboard/flow/page.tsx` — cálculo server-side (fuente de verdad)
- `components/dashboard/MonthlyFlowTable.tsx` — rendering de la tabla
- `components/dashboard/FlowCellBreakdownDialog.tsx` — dialog de desglose al hacer clic
- `lib/domain/income.ts` — modos de cálculo de Nómina (display, remaining, blended)

### Columnas

| Columna | Qué muestra | Fórmula / Origen |
|---------|-------------|------------------|
| **Mes** | Mes calendario. Badge de bandera en el mes de onboarding | — |
| **Capital Inicio** | Saldo real de cuentas débito al inicio del mes | Mes onboarding: back-calculated. Mes actual: `patrimonioActual`. Futuros: Capital Fin del mes anterior |
| **Nómina** | Ingreso esperado del mes según `income_sources` | Siempre usa `display` mode: `base_amount × expectedPaymentCount`. Badge verde si hay pagos confirmados |
| **Abonos** | Transacciones `type=income` en cuentas débito + planned transfers `direction=in` | Suma de montos reales (transacciones) + proyección (planned transfers) |
| **Ingresos Totales** | Suma real de todos los ingresos: nómina (blended) + abonos + otros | Clickeable → abre dialog de desglose. Para mes actual: `nómina_blended + abonos_reales + planned_transfers_in_blended + otrosIngresos`. Para otros meses = Por Cobrar |
| **Por Cobrar** | Ingresos que aún faltan por llegar. **Alimenta Capital Fin** | Varía según modo temporal (ver abajo) |
| **Transferencias** | Planned transfers `direction=out` desde cuentas débito | Confirmados + proyección según modo temporal |
| **Tarjetas** | Total pagos a tarjetas de crédito | `purchases + msi + recurringCharges + untracked + flowAdjustment` por tarjeta, usando billing period |
| **[Préstamo X]** | Columna dinámica por cada cuenta `type=loan` activa | Pasado: monto confirmado. Actual: mensualidad si no confirmado. Futuro: mensualidad si dentro del plazo |
| **Gastos Totales** | Suma de todas las salidas | `Transferencias + Tarjetas + Σ Préstamos + ajustes manuales de gasto` |
| **Capital Fin** | Saldo proyectado al cierre del mes | `Capital Inicio + Por Cobrar − Gastos Totales` |
| **% Variación** | Cambio porcentual de Capital Fin vs mes anterior | `((Capital Fin - Capital Fin anterior) / Capital Fin anterior) × 100` |

### Ingresos Totales vs Por Cobrar

Son columnas distintas con propósitos distintos:

- **Ingresos Totales** = vista informativa del total de ingresos (confirmados + proyectados restantes). Incluye nómina blended + abonos reales + planned transfers + otros ingresos.
- **Por Cobrar** = solo lo que falta por llegar. Es el operando de la fórmula `Capital Fin = Capital Inicio + Por Cobrar − Gastos Totales`.

Para el mes actual divergen: Ingresos Totales incluye pagos ya confirmados y abonos reales; Por Cobrar solo cuenta lo pendiente (remaining-only) para evitar double-counting con Capital Inicio. Para meses pasados y futuros, ambas coinciden.

### Modos temporales

La tabla usa tres modos según la relación del mes con el mes actual:

#### Mes pasado
| Campo | Comportamiento |
|-------|---------------|
| Nómina (display) | `Σ income_entries.amount` (solo confirmados reales) |
| Por Cobrar | `Σ income_entries.amount + abonos + otrosIngresos` |
| Ingresos Totales | Igual que Por Cobrar (todo es real/confirmado) |
| Abonos | Transacciones reales + planned transfers confirmados |
| Transferencias | Planned transfers confirmados |
| Tarjetas | Gastos reales del billing period |

#### Mes actual (`remaining-only`)
| Campo | Comportamiento |
|-------|---------------|
| Nómina (display) | `base_amount × expectedPaymentCount` — proyección completa, informativo |
| Por Cobrar | **Solo remaining**: `(expectedCount − confirmedCount) × base_amount + otrosIngresos`. Abonos excluidos |
| Ingresos Totales | `nómina_blended + abonos_reales + planned_transfers_in_blended + otrosIngresos` — incluye confirmados |
| Abonos | Se muestra pero **NO suma** a Por Cobrar (ya están en Capital Inicio) |
| Transferencias | Remaining-only de planned transfers |

**¿Por qué remaining-only en Por Cobrar?** Capital Inicio se ancla a `patrimonioActual` (saldo real del banco). Los pagos ya confirmados ya están reflejados en ese saldo. Si se sumaran de nuevo en Por Cobrar, habría double-counting.

**Window de double-counting:** Entre que el dinero cae al banco y el usuario confirma, Capital Inicio sube (refleja el saldo real) pero Por Cobrar aún cuenta ese pago como pendiente. Se corrige al confirmar.

#### Mes futuro (`blended`)
| Campo | Comportamiento |
|-------|---------------|
| Nómina (display) | `blended` = confirmados reales + remaining × base_amount |
| Por Cobrar | `blended nómina + abonos + otrosIngresos` |
| Ingresos Totales | Igual que Por Cobrar (todo es proyectado) |
| Abonos | Transacciones reales + planned transfers (blended) |
| Transferencias | Planned transfers (blended) |
| Tarjetas | Proyección: MSI programados + recurrentes esperados |

### Nómina: display vs cálculo

La columna Nómina y Por Cobrar usan **valores distintos a propósito** en el mes actual:

- **Nómina (lo que se ve)** = `display` mode → `base_amount × expectedPaymentCount`. Muestra el ingreso total esperado del mes.
- **Por Cobrar (lo que calcula)** = `remaining-only` mode → `(expected − confirmed) × base_amount`. Solo lo que falta por entrar.

Ejemplo con nómina quincenal de $23,698.75 y 1 pago confirmado:
- Nómina muestra: $47,397.50 (2 × base) con badge "1 pago confirmado"
- Por Cobrar usa: $23,698.75 (1 × base, solo el pendiente)
- Ingresos Totales: $47,397.54 si el confirmado fue $23,698.79 (blended = real + projected remaining)

**Nota:** El `display` mode siempre usa `base_amount`, no el monto real confirmado. Si el usuario confirmó $23,698.79 (4 centavos más), la columna Nómina sigue mostrando $47,397.50. Ingresos Totales sí refleja el monto real confirmado.

### Mes de onboarding

El mes en que el usuario empieza a usar Finkhy tiene lógica especial porque no hay historial previo:

1. **Capital Fin** = `patrimonioActual` (suma de saldos reales de cuentas débito). Es un ancla fija, no calculada por el flujo.
2. **Capital Inicio** = se calcula **hacia atrás**: `Capital Fin − Por Cobrar + Gastos Totales`.
3. **Meses posteriores** = flujo tradicional hacia adelante: Capital Inicio del mes N+1 = Capital Fin del mes N.

El mes de onboarding se marca con un ícono de bandera naranja en la columna Mes.

### Dialog de desglose

Al hacer clic en **Ingresos Totales** o **Gastos Totales**, se abre `FlowCellBreakdownDialog` que muestra:

- **Ingresos Totales**: desglose por fuente de ingreso (con slots esperados y confirmados), abonos, planned transfers in, y ajustes manuales de ingreso.
- **Gastos Totales**: desglose por tarjeta (purchases + MSI + recurrentes + untracked + flow adjustment), préstamos, transferencias, y ajustes manuales de gasto.

### Footer

Fila "Total anual" que suma cada columna numérica para todos los meses visibles del año.
