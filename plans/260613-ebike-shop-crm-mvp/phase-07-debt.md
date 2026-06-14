# Phase 07 — Debt (Công Nợ) Module

## Context Links
- Overview: [plan.md](./plan.md)
- Domain model (debt + aging): [../research/researcher-02-domain-model.md](./research/researcher-02-domain-model.md)
- Depends on: [phase-04-pos-sales.md](./phase-04-pos-sales.md), [phase-05-customers.md](./phase-05-customers.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Fill the debt helper stubbed in Phase 04: auto-create a debt when a sale is underpaid. Record partial payments. Compute outstanding per debt/customer + aging report (0-30 / 31-60 / 61-90 / 90+) — all computed, never stored.
- **Priority:** High (explicitly in-scope beyond base MVP)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Debt created at sale time: `amountVnd = total - paid`, `issuedDate = saleDate`, `dueDate` from POS (default saleDate+30, open Q4/Q5).
- Outstanding per debt = `amountVnd - Σ debt_payments.amountVnd`. status: paid (outstanding ≤ 0), partial (some paid), open (none).
- Aging buckets COMPUTED from `dueDate` vs today — no stored bucket column.
- Payment can be partial; multiple payments per debt. Auto-update status after each.
- No overpayment handling (YAGNI). Block payment > outstanding.

## Requirements
### Functional
- Auto-create debt on underpaid sale (fill Phase 04 stub).
- Debt list: customer, sale, amount, paid, outstanding, due date, status, age bucket.
- Record payment (amount ≤ outstanding, method, date) → updates status.
- Aging report: grouped buckets with totals + customer breakdown.
- Filter: by customer, by status, overdue only.

### Non-Functional
- All integer VND. Aging always current (date-based query).

## Architecture
- Fill `src/main/repos/_hooks.ts::createDebtForSale`.
- IPC: `debts:list`, `debts:get`, `debts:addPayment`, `debts:aging`, `debts:outstandingByCustomer`.
- Aging computed in SQL CASE or in JS with dayjs (KISS: JS over fetched rows — easier for beginner, dataset small).

## createDebtForSale (fill stub)
```ts
createDebtForSale(saleId, customerId, amountVnd, dueDate) {
  if (amountVnd <= 0) return
  db.insert(debts).values({ customerId, saleId, issuedDate: today(),
    dueDate: dueDate ?? dayjs().add(30,'day').format('YYYY-MM-DD'),
    amountVnd, status:'open' }).run()
}
```
(Called inside Phase 04 sale txn.)

## Payment + status (`src/main/repos/debts.ts`)
```ts
addPayment(debtId, amountVnd, method, paymentDate) {
  return getSqlite().transaction(() => {
    const debt = get(debtId)
    const paid = sumPayments(debtId)
    const outstanding = debt.amountVnd - paid
    if (amountVnd <= 0 || amountVnd > outstanding) throw new Error('Số tiền không hợp lệ')
    db.insert(debtPayments).values({ debtId, amountVnd, method, paymentDate }).run()
    const newOutstanding = outstanding - amountVnd
    const status = newOutstanding <= 0 ? 'paid' : 'partial'
    db.update(debts).set({ status }).where(eq(debts.id, debtId)).run()
  })()
}
```

## Aging (compute in JS)
```ts
function bucket(dueDate) {
  const d = dayjs().diff(dayjs(dueDate), 'day')   // days overdue
  if (d <= 0) return 'current'
  if (d <= 30) return '1-30'
  if (d <= 60) return '31-60'
  if (d <= 90) return '61-90'
  return '90+'
}
// aging(): fetch open/partial debts + their paid sums → outstanding>0 → group by bucket(dueDate)
```

## Related Code Files
**Create:**
- `src/renderer/src/features/debt/DebtPage.tsx`
- `.../debt/{DebtTable,AddPaymentModal,AgingReport}.tsx`
- `src/main/repos/debts.ts` (full: list, addPayment, aging, outstandingByCustomer, sumPayments)
- `src/main/ipc/debts.ts`
**Modify:**
- `src/main/repos/_hooks.ts` (implement createDebtForSale)
- `src/renderer/.../customers/profile/DebtTab.tsx` (real data)
- preload/index.ts, index.d.ts

## Implementation Steps
1. Implement `createDebtForSale`; verify Phase-04 underpaid sale creates a debt row (atomic).
2. `outstandingByCustomer(id)`: Σ amount - Σ payments across customer debts (fills Phase 05 debt tab).
3. `list()` returns debts with computed paid/outstanding/age bucket (join payments or per-row sum).
4. `addPayment` per snippet (transaction; validate ≤ outstanding; update status).
5. `aging()` groups outstanding>0 debts into buckets with sum + count + customer detail.
6. UI DebtTable: columns + status/age badges; row → AddPaymentModal.
7. AgingReport: Mantine table/cards per bucket with totals; "overdue only" filter.
8. Wire customer profile Debt tab.

## Todo List
- [ ] createDebtForSale implemented (atomic w/ sale)
- [ ] sumPayments + outstanding helpers
- [ ] debts.list with computed paid/outstanding/bucket
- [ ] addPayment (validate, status update, txn)
- [ ] aging report (buckets + totals)
- [ ] DebtPage + AddPaymentModal + AgingReport
- [ ] customer Debt tab wired

## Success Criteria
- Underpaid sale (Phase 04) auto-creates a debt with correct amount + due date.
- Add partial payment → status partial, outstanding reduced; full payment → paid.
- Payment > outstanding rejected.
- Aging report puts a 45-day-overdue debt in 31-60; current debt in 'current'.
- Customer profile shows correct total outstanding.

## Risk Assessment
- **Status drift (MED):** status not recomputed after payment. Mitigate: recompute in addPayment txn.
- **Aging timezone/day-diff off-by-one (LOW):** use consistent `dayjs().startOf('day')`. Test in Phase 10.
- **Double-counting paid amount (MED):** single source = debt_payments sum; never store paid on debt.

## Security Considerations
- Server-side validate amounts (positive, ≤ outstanding). No negative payments.
- Single-user; no approval workflow (YAGNI).

## Next Steps
- Phase 08 dashboard surfaces overdue-debt alert + aging summary KPI.
