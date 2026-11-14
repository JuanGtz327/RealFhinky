# Finkhy — Progress

_Última actualización: 2026-11-13_

---

## Completado

### Fundación (Fases 1–5)
- Next.js 14 + TypeScript + App Router + Tailwind + shadcn/ui
- SQLite via better-sqlite3, patrón Repository, interfaz `IDatabase`
- Schema completo: `accounts`, `transactions`, `msi_installments`, `income_sources`, `income_entries`, `user_preferences`
- Columnas nuevas: `opening_balance_carryover` en `accounts`, `custom_interval_days` en `income_sources`
- API Routes: accounts, transactions, income sources/entries, dashboard (flow, breakdown, summary), settings (reset, seed, export, import, preferences), accounts/opening-balance

### Dashboard `/dashboard`
- Tabla 1: Flujo General Mensual con columnas dinámicas de préstamos
  - `capital_inicio` anclado a saldos reales de cuentas débito (mes actual) o proyectado (meses futuros)
  - Proyección de ingresos futuros desde `income_sources` con `projectMonthlyIncome()`
  - `abonos` = solo `type=income`; `transferencias` = solo `type=purchase` (semántica correcta)
- Tabla 2: Desglose por Tarjeta (año colapsable, mes resaltado, proyectado en cursiva)
- Widget: Cuentas Débito, Deuda, Tarjetas con alertas de fechas

### Cuentas `/accounts`, `/accounts/[id]`
- Lista separada crédito vs débito
- Detalle crédito: metadatos, tabla mes a mes, MSI activos, transacciones recientes
- Detalle débito: metadatos, historial de movimientos
- **OpeningBalanceWizard**: onboarding para tarjetas con saldo existente pero sin transacciones (3 secciones: compras del mes, MSI activos, arrastre opaco)
- **MsiActiveList** con `SmoothDrawer`: muestra todas las cuotas pagadas (tachadas, verde) y pendientes (naranja) con animación de dígitos rolling

### Transacciones `/transactions`
- Tabla global con filtros
- Formulario con tipos de transacción por tipo de cuenta:
  - Crédito: `purchase` (Compra/Cargo), `transfer_in` (Pago a tarjeta)
  - Débito: `income`, `purchase`, `transfer_out`, `transfer_in`
- Default en débito: `income` (no `purchase`)
- MSI con precisión decimal correcta (`Math.round` no `Math.floor`)
- `expandMsi` recibe `startDate` para cuotas en meses correctos
- Balance de cuenta se actualiza automáticamente al crear/eliminar transacciones

### Configuración `/settings`
- Preferencias UI (moneda, formato fecha, tema)
- Export/Import JSON completo
- Reset de datos (SlideToConfirm)
- Re-seed datos demo (SlideToConfirm)
- Gear icon en Navbar con active state

### Componentes Kokonut UI
- `empty-state`, `promise-toast`, `slide-to-confirm`, `smooth-drawer`
- `smooth-drawer` adaptado para base-ui (no vaul), paleta Finkhy, animación spring, dígitos rolling, color-coded pagado/pendiente

### Forecast `/forecast`
- Fuentes de ingreso (frecuencia custom con `custom_interval_days`)
- Proyección mensual con alertas de flujo negativo

---

## Pendiente / Siguiente

### En progreso
- **Verificar drawer en desktop**: la fix `sm:!left-[30%] sm:!right-[30%]` está en el CSS generado; pendiente confirmar visualmente que el drawer aparece centrado al 40% en pantallas ≥640px.

### Backlog
- [ ] Forecast: gráfica visual (Recharts) de flujo proyectado
- [ ] Dashboard: modo oscuro (variable `--color-bg` cambiada, shadcn bridge tokens)
- [ ] Accounts: edición inline de saldo desde la lista
- [ ] Transactions: edición en tabla (double-click)
- [ ] Settings: cambio de tema funcional (actualmente disabled)
- [ ] PostgreSQL: activar adaptador al definir `DATABASE_URL`
- [ ] Tests: agregar cobertura para `OpeningBalanceWizard`, `balanceDelta`, `projectMonthlyIncome`
- [ ] PWA / mobile: soporte táctil para `SmoothDrawer` snap points
