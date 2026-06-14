# Phase 05 — Customers Module

## Context Links
- Overview: [plan.md](./plan.md)
- Domain model: [../research/researcher-02-domain-model.md](./research/researcher-02-domain-model.md)
- Depends on: [phase-04-pos-sales.md](./phase-04-pos-sales.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Customer profiles + 360° view: purchase history, debt summary (outstanding), active warranties, upcoming maintenance. Mostly read aggregation over existing tables.
- **Priority:** Medium
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Customer already creatable inline from POS (Phase 04). This phase = full CRUD + profile aggregation.
- Outstanding = `Σ debts.amountVnd - Σ debt_payments.amountVnd` for customer (debt tables from Phase 02; populated by 04/07).
- Active warranties = warranty_records where computed end_date ≥ today, joined via inventory_units → customer.
- Reuse `formatVnd`, warranty end-date compute helper (shared with Phase 06).

## Requirements
### Functional
- List/search customers (name/phone).
- Create/edit/soft-considerations: deleting a customer with sales/debts → block or warn (block in v1).
- Profile page: info, purchase history (sales list), total spent, current outstanding debt, list of owned bikes (serials), active warranties w/ end dates, upcoming service dates.

### Non-Functional
- Aggregations are single queries; fast for hundreds of customers.

## Architecture
- UI: `CustomersPage` (table) → `CustomerProfilePage` (tabs: Info / Lịch sử mua / Công nợ / Bảo hành / Bảo dưỡng).
- IPC: `customers:list/get/create/update`, `customers:profile` (aggregate bundle).

## Data Flow
`customers:profile(id)` → main runs several queries (sales, units owned, warranties, reminders, debt balance) → returns one composed object → renderer renders tabs.

## Profile Aggregate (pseudocode `src/main/repos/customers.ts`)
```ts
getProfile(id) {
  const customer = get(id)
  const salesList = db.select().from(sales).where(eq(sales.customerId, id)).all()
  const totalSpent = salesList.reduce((s, x) => s + x.totalVnd, 0)
  const owned = db.select().from(inventoryUnits)            // via sale_items join
        .innerJoin(saleItems, ...).innerJoin(sales, eq(sales.customerId, id)).all()
  const warranties = warrantyRepo.activeByCustomer(id)      // end_date >= today
  const reminders = maintenanceRepo.upcomingByCustomer(id)
  const outstanding = debtsRepo.outstandingByCustomer(id)   // Σdebt - Σpay
  return { customer, salesList, totalSpent, owned, warranties, reminders, outstanding }
}
```

## Related Code Files
**Create:**
- `src/renderer/src/features/customers/CustomersPage.tsx`
- `.../customers/CustomerFormModal.tsx`, `CustomerProfilePage.tsx`
- `.../customers/profile/{InfoTab,PurchasesTab,DebtTab,WarrantyTab,MaintenanceTab}.tsx`
- `src/main/repos/customers.ts` (extend: getProfile)
- `src/main/ipc/customers.ts` (extend: profile)
**Modify:**
- `src/main/repos/debts.ts` (`outstandingByCustomer`) — may be stubbed until Phase 07
- `src/main/repos/warranty.ts` (`activeByCustomer`) — until Phase 06
- preload/index.ts, index.d.ts

## Implementation Steps
1. Customers CRUD table (Mantine) + form modal (name required, phone optional). Search by name/phone.
2. Block delete if customer has sales or open debts → friendly message.
3. `getProfile` aggregate query bundle. For repos not yet built (warranty/debt), return empty arrays/0 now; fill when those phases land.
4. Profile tabs: Info (editable), Purchases (sales table → detail), Debt (outstanding + debt list — wire fully Phase 07), Warranty (active list — Phase 06), Maintenance (upcoming dates — Phase 06).
5. Shared helper `warrantyEndDate(startDate, months)` in `src/shared/dates.ts` (used here + Phase 06/08).

## Todo List
- [ ] Customers CRUD + search
- [ ] Block delete w/ dependents
- [ ] getProfile aggregate IPC
- [ ] Profile page tabs scaffolded
- [ ] Purchases tab (real sales data)
- [ ] Debt/Warranty/Maintenance tabs (graceful empty until 06/07)
- [ ] shared dates helper

## Success Criteria
- Create/edit/search customers.
- Profile of the slice customer (Phase 04) shows the sale, total spent, owned bike serial.
- Outstanding shows correct number once Phase 07 done (verify retroactively).
- Delete blocked when customer has a sale.

## Risk Assessment
- **Cross-phase repo dependency (MED):** profile needs warranty/debt repos. Mitigate: graceful-empty stubs; re-verify after 06/07.
- **N+1 queries (LOW):** few customers; fine. Optimize only if slow.

## Security Considerations
- Validate phone/email format lightly (non-blocking).
- No PII export feature v1 (YAGNI). Data stays local.

## Next Steps
- Phase 06 fills warranty/maintenance tabs. Phase 07 fills debt tab. Phase 08 dashboard reuses aggregates.
