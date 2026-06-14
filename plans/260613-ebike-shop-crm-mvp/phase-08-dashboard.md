# Phase 08 — Dashboard

## Context Links
- Overview: [plan.md](./plan.md)
- Domain model: [../research/researcher-02-domain-model.md](./research/researcher-02-domain-model.md)
- Depends on: [phase-03-inventory.md](./phase-03-inventory.md) … [phase-07-debt.md](./phase-07-debt.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Home screen aggregating all modules: KPI cards, revenue chart (Recharts), and actionable alert lists (low stock, overdue debt, warranty expiring, maintenance due). Read-only aggregation; no new tables.
- **Priority:** Medium (value-add, comes after data exists)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Pure aggregation over Phases 02-07. Build LAST so all sources exist.
- One IPC `dashboard:summary` returning a single bundle keeps renderer simple + fast.
- Revenue chart: group sales by day/month → sum totalVnd. dayjs for grouping; small data → compute in JS.
- Alerts are clickable → navigate to the relevant module (deep link via app nav state).

## Requirements
### Functional
- KPI cards: revenue this month, sales count this month, total outstanding debt, units in stock, low-stock count.
- Revenue chart: last 6-12 months bar/line (Recharts).
- Alert panels:
  - Low stock (products where stock ≤ threshold).
  - Overdue debt (debts past due, outstanding > 0) + total overdue.
  - Warranty expiring soon (end_date within 30 days).
  - Maintenance due (next_service_date within 30 days / overdue).
- Each alert row → jump to module.

### Non-Functional
- Single `dashboard:summary` call; renders < 500ms for typical data.

## Architecture
- UI: `DashboardPage` → `KpiCards` + `RevenueChart` + `AlertsGrid` (4 panels).
- IPC: `dashboard:summary` → composes from existing repos (productsRepo.lowStock, debtsRepo.aging/overdue, warrantyRepo.expiringSoon, maintenanceRepo.upcoming, salesRepo.revenueByMonth).

## Summary bundle (pseudocode `src/main/repos/dashboard.ts`)
```ts
getSummary() {
  return {
    kpis: {
      revenueThisMonth: salesRepo.revenueBetween(startOfMonth, today),
      salesCountThisMonth: salesRepo.countBetween(startOfMonth, today),
      totalOutstanding: debtsRepo.totalOutstanding(),
      unitsInStock: inventoryRepo.inStockCount(),
      lowStockCount: productsRepo.lowStock().length,
    },
    revenueByMonth: salesRepo.revenueByMonth(12),   // [{month:'2026-06', total: n}, ...]
    alerts: {
      lowStock: productsRepo.lowStock(),
      overdueDebts: debtsRepo.overdue(),
      expiringWarranties: warrantyRepo.expiringSoon(30),
      maintenanceDue: maintenanceRepo.upcoming(30),
    }
  }
}
```

## Related Code Files
**Create:**
- `src/renderer/src/features/dashboard/DashboardPage.tsx`
- `.../dashboard/{KpiCards,RevenueChart,AlertsGrid}.tsx`
- `src/main/repos/dashboard.ts`
- `src/main/ipc/dashboard.ts`
**Modify:**
- existing repos: add `revenueByMonth/revenueBetween/countBetween` (sales), `lowStock` (products), `totalOutstanding/overdue` (debts), `expiringSoon` (warranty), `inStockCount` (inventory)
- preload/index.ts, index.d.ts
- AppShell default route → Dashboard

## Implementation Steps
1. Add the small aggregate queries to each repo (reuse computed helpers: aging bucket, warranty end date).
2. `dashboard.ts getSummary` composes bundle.
3. `KpiCards`: Mantine `Card`+`Group`; format VND.
4. `RevenueChart`: Recharts `BarChart` over `revenueByMonth` (XAxis month, YAxis VND).
5. `AlertsGrid`: 4 Mantine `Card`s with lists; empty-state text; each row clickable → set app view to module (pass filter where useful, e.g. low-stock filter).
6. Make Dashboard the landing view.

## Todo List
- [ ] repo aggregate queries added
- [ ] dashboard:summary IPC
- [ ] KPI cards
- [ ] Recharts revenue chart
- [ ] 4 alert panels (low stock / overdue / warranty / maintenance)
- [ ] alert rows navigate to modules
- [ ] Dashboard = landing

## Success Criteria
- KPIs match manual counts from data created in earlier phases.
- Revenue chart shows the slice sale in the right month.
- Low-stock product appears in alert; overdue debt appears; expiring warranty + maintenance-due appear with correct dates.
- Clicking an alert navigates to the module.

## Risk Assessment
- **Month grouping format mismatch (LOW):** standardize `YYYY-MM`. 
- **Slow if many queries (LOW):** small dataset; one bundle call fine. Optimize only if needed.
- **Stale data after edits (MED):** refetch summary on dashboard mount / focus.

## Security Considerations
- Read-only aggregation; no writes. Same IPC isolation rules.

## Next Steps
- Phase 09 packages the now-complete app; Phase 10 manual-tests all flows incl. dashboard accuracy.
