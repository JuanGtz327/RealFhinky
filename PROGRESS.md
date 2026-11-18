# Finkhy — Progress

_Última actualización: 2026-11-17_

---

## 📋 Todas las Fases Completadas

Para el tracking detallado de todas las fases completadas (1–15), ver el histórico en [CLAUDE.md](./CLAUDE.md) sección "📋 Tracking de Tareas".

### Resumen Ejecutivo

**Fases 1–10:** Fundación, DB, Repositorios, API, UI, Dashboard, Cuentas, Transacciones, Forecast
- Next.js 14 + TypeScript + App Router + Tailwind v4 + shadcn/ui
- SQLite via better-sqlite3, patrón Repository, interfaz `IDatabase` (preparado para PostgreSQL)
- Schema completo con tablas de soporte (MSI, Income, User Preferences)
- API Routes para todas las entidades principales
- Componentes UI normalizados con paleta de colores Warm Light Theme
- Dashboard con 2 tablas principales + 3 widgets de KPIs

**Fase 11 — Base de Calidad:** 
- Extracción de lógica de negocio a `lib/domain/` (funciones puras)
- Migración Jest → Vitest
- Suite de tests funcionales para dominio (flow, yields, credit, balance, kpis)
- Documentación de arquitectura

**Fase 12 — Confirmación de Pagos por Ciclo:**
- Tabla `cycle_payments` con status derivado (paid/partial/pending)
- Domain logic y repositorio
- UI: ConfirmPaymentDialog + NextCyclePreview integrado
- Dashboard indicators reflejan confirmación

**Fase 13 — Confirmación de Ingresos:**
- Domain logic: blending de confirmados + proyectados, no double-counting
- Repository extensions para income entries
- API routes para CRUD de entradas
- Flow table con semantics correcta (current-month remaining-only, futuro blended)
- UI: ConfirmIncomeDialog, IncomeSourceCard con progreso

**Fase 14 — Cargos Recurrentes y Transferencias Planificadas:**
- Tablas `recurring_charges`, `recurring_charge_entries`, `planned_transfers`, `planned_transfer_entries`
- Domain logic: blending temporal, alertas por vencer
- Integración con flow table (por tarjeta/cuenta)
- Integración con NextCyclePreview (proyectado vs confirmado)
- UI centralizada: `/subscriptions` para cargos, sección en `/accounts/[id]` para planned transfers

**Fase 15 — Préstamos como Ciudadanos de Primera Clase:**
- 6 columnas nuevas en `accounts` para amortización francesa
- Domain logic completo: schedule, progreso, payoff, proyección en flow table
- AccountMetaLoan + LoanAmortizationTable con desglose capital/interés
- Confirmación de pagos variable (actualiza balance automáticamente)
- Integración en flow table y dashboard (columnas dinámicas, widget de deuda separado)

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
