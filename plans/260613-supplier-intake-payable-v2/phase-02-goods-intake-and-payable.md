# Phase 02 — Supplier Goods Intake & Accounts-Payable

## Context Links
- Overview: [plan.md](./plan.md)
- Depends on: [phase-01-suppliers-and-schema.md](./phase-01-suppliers-and-schema.md)
- EXTENDS main intake: [../260613-ebike-shop-crm-mvp/phase-03-inventory.md](../260613-ebike-shop-crm-mvp/phase-03-inventory.md)
- REUSES main debt: [../260613-ebike-shop-crm-mvp/phase-07-debt.md](../260613-ebike-shop-crm-mvp/phase-07-debt.md)
- Research (intake→stock→payable flow): [./research/researcher-01-supplier-payable.md](./research/researcher-01-supplier-payable.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Simplified supplier intake (one step). Pick NCC + line items (serialized bikes w/ serials, OR quantity accessories) + unit cost → ONE atomic transaction: create inventory (units / qtyOnHand) + write `stock_movements` + auto-create a payable `debt`. Payable list/aging reuse Phase 07 with a `direction='payable'` filter. Partial supplier payments via existing Phase 07 `addPayment`.
- **Priority:** High.
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- EXTEND Phase 03 `intakeSerialized` / `adjustQuantity` — do NOT reinvent inventory writes. New supplier-intake repo CALLS the same primitives inside one wrapping txn, then writes movements + payable.
- NO `goods_receipts`/`receipt_items` header tables (research over-engineering, rejected). Group a multi-line intake by a generated `batchId` (string/int) stamped on each `stock_movements.refId` (refType='supplier_intake') + recorded in payable `notes`. One payable debt per intake = the invoice total. (See plan.md unresolved Q2.)
- Payable auto-create REUSES `debts` (direction='payable'). `amountVnd` = Σ(line qty × unitCostVnd). `dueDate` = receiptDate + supplier.paymentTermsDays. Mirrors Phase 07 `createDebtForSale` but for payable.
- Phase 07 `addPayment` is keyed by debtId → works unchanged for payables. Phase 07 `aging()` works unchanged once we pass a direction filter.
- If full amount paid at intake (cash on receipt) → no debt (parallels underpaid-sale rule: only create debt for unpaid/partial). Optional `paidAtIntakeVnd`.

## Requirements
### Functional
- Intake form: select supplier → add lines. Each line: product (SERIALIZED → serials[]; QUANTITY → qty) + unitCostVnd. receiptDate, optional invoice ref note, optional paidAtIntake.
- Submit → atomic: inventory created, movements written, payable debt created (if owed > 0).
- Payable list (công nợ phải trả NCC): supplier, amount, paid, outstanding, dueDate, status, age bucket. Filter direction='payable'.
- Record supplier payment (reuse Phase 07 addPayment) → status updates.
- Payable aging report (reuse Phase 07 aging with payable filter).

### Non-Functional
- All-or-nothing transaction (dup serial / bad line → full rollback, no debt, no movements).
- Integer VND. Dates ISO. Aging computed, never stored.

## Architecture (data flow)
```
SupplierIntakePage → window.api.supplierIntake.receive(dto)
  → ipc supplierIntake:receive → supplierIntakeRepo.receive()
     [ single getSqlite().transaction:
        for each line: Phase03 intakeSerialized() OR adjustQuantity()
        write stock_movements (type 'in', refType 'supplier_intake', refId=batchId)
        if owed>0: insert debts (direction 'payable', supplierId, dueDate)
     ]
PayablePage → reuse debts.list({direction:'payable'}) + debts.aging({direction:'payable'})
            + debts.addPayment(debtId,...)  ← Phase 07, unchanged
```

## Atomic intake txn (pseudocode — `src/main/repos/supplierIntake.ts`)
```ts
receive(dto) { // dto: { supplierId, receiptDate, refNote?, paidAtIntakeVnd=0, lines: Line[] }
  // Line = { productId, type, serials?: string[], qty?: number, unitCostVnd }
  return getSqlite().transaction(() => {
    const batchId = nextBatchId()            // or use the created debtId as group key
    let total = 0
    for (const ln of dto.lines) {
      if (ln.type === 'SERIALIZED') {
        // REUSE Phase 03 primitive (extended to accept supplierId)
        const unitIds = inventoryRepo.intakeSerialized({
          productId: ln.productId, serials: ln.serials,
          costVnd: ln.unitCostVnd, acquiredDate: dto.receiptDate,
          supplierId: dto.supplierId,            // NEW arg (phase-01 inventory_units.supplierId)
        })                                       // throws on dup serial → whole txn rolls back
        for (const uId of unitIds)
          insertMovement({ productId: ln.productId, inventoryUnitId: uId,
            type: 'in', qty: 1, refType: 'supplier_intake', refId: batchId })
        total += ln.serials.length * ln.unitCostVnd
      } else { // QUANTITY
        inventoryRepo.adjustQuantity(ln.productId, +ln.qty, 'supplier intake') // REUSE Phase 03
        insertMovement({ productId: ln.productId, inventoryUnitId: null,
          type: 'in', qty: ln.qty, refType: 'supplier_intake', refId: batchId })
        total += ln.qty * ln.unitCostVnd
      }
    }
    createPayableForIntake(dto.supplierId, total, dto.paidAtIntakeVnd, dto.receiptDate, batchId, dto.refNote)
    return { batchId, total }
  })()
}
```

## Payable auto-create (pseudocode)
```ts
createPayableForIntake(supplierId, totalVnd, paidAtIntakeVnd, receiptDate, batchId, refNote) {
  const owed = totalVnd - (paidAtIntakeVnd ?? 0)
  if (owed <= 0) return            // paid in full at receipt → no debt (parallels Phase 07 underpaid rule)
  const terms = suppliersRepo.get(supplierId).paymentTermsDays ?? 0   // unresolved Q5
  const dueDate = dayjs(receiptDate).add(terms, 'day').format('YYYY-MM-DD')
  db.insert(debts).values({
    direction: 'payable', supplierId, customerId: null, saleId: null,
    issuedDate: receiptDate, dueDate, amountVnd: owed, status: 'open',
    notes: `Nhập kho NCC #${batchId}${refNote ? ' — ' + refNote : ''}`,
  }).run()
}
```

## Direction-filtered list + aging (REUSE Phase 07 — extend signature)
```ts
// Phase 07 debts.list/aging gain an optional { direction } filter (default 'receivable' = unchanged).
list({ direction = 'receivable' } = {}) {
  return db.select().from(debts).where(eq(debts.direction, direction)).all()
    // + per-row Σ debt_payments → paid/outstanding/bucket (existing logic)
}
aging({ direction = 'receivable' } = {}) { /* same buckets, filtered by direction */ }
// "Công nợ phải trả NCC" view calls list({direction:'payable'}); join suppliers for name.
```

## Related Code Files
**Create:**
- `src/main/repos/supplierIntake.ts` (receive txn, createPayableForIntake, insertMovement)
- `src/main/ipc/supplierIntake.ts` (`supplierIntake:receive`)
- `src/renderer/src/features/suppliers/SupplierIntakePage.tsx`
- `.../suppliers/{IntakeLineEditor,IntakeReview}.tsx`
- `src/renderer/src/features/payable/PayablePage.tsx`
- `.../payable/{PayableTable,PayableAging}.tsx` (thin — reuse Phase 07 debt components w/ direction prop)

**Modify (OVERLAP — flag):**
- `src/main/repos/inventory.ts` — **EXTENDS Phase 03**: `intakeSerialized` accepts optional `supplierId`, returns created unit ids; `adjustQuantity` reused as-is (or returns void).
- `src/main/repos/debts.ts` — **EXTENDS Phase 07**: `list`/`aging` accept optional `{direction}` filter; `addPayment` unchanged (reused for payables).
- `src/renderer/.../debt/{DebtTable,AgingReport}.tsx` — **REUSE Phase 07**: add a `direction` prop so payable views render same components (DRY) — or wrap.
- `src/shared/types.ts` — IntakeDto, IntakeLine, PayableRow.
- `src/main/index.ts`, `src/preload/index.ts`, `index.d.ts` — register/expose `supplierIntake` + payable.

## Implementation Steps
1. EXTEND Phase 03 `intakeSerialized` to accept optional `supplierId` and RETURN created unit ids (needed for per-unit movements). Keep backward compatible.
2. `supplierIntake.receive(dto)` per pseudocode — ONE wrapping `getSqlite().transaction`. Dup serial / negative qty throws → full rollback (verify no debt/movement written).
3. `insertMovement` helper writes `stock_movements` (type 'in', refType 'supplier_intake', refId=batchId).
4. `createPayableForIntake` per pseudocode (skip if owed ≤ 0; dueDate via dayjs + terms).
5. IPC `supplierIntake:receive`; preload + types.
6. EXTEND Phase 07 `debts.list`/`aging` with optional `{direction}` filter; default keeps receivable behavior intact.
7. UI `SupplierIntakePage`: supplier select (active only) → add lines (`@mantine/form`); SERIALIZED line shows serials input (reuse Phase 03 serial entry), QUANTITY shows qty; each line unitCostVnd. Live total. Optional paidAtIntake + refNote. Submit → `receive`.
8. UI `PayablePage`: reuse Phase 07 `DebtTable`/`AgingReport` with `direction='payable'` (join supplier name). Row → reuse Phase 07 `AddPaymentModal` (addPayment).
9. Verify end-to-end: intake 2 bikes + 5 accessories, terms 30 → stock up, 2 unit-movements + 1 qty-movement, 1 payable debt amount=total, due=receiptDate+30. Partial payment → status partial; full → paid. Payable aging buckets a 45-day-overdue payable into 31-60.

## Todo List
- [ ] intakeSerialized extended (supplierId, returns unit ids), backward compatible
- [ ] supplierIntake.receive atomic txn (rollback on dup serial)
- [ ] insertMovement → stock_movements (type 'in')
- [ ] createPayableForIntake (owed>0, due=receipt+terms)
- [ ] supplierIntake IPC + preload + types
- [ ] debts.list/aging extended with direction filter (receivable unchanged)
- [ ] SupplierIntakePage (lines: serialized vs qty, cost, total)
- [ ] PayablePage reuses Phase 07 components (direction='payable')
- [ ] supplier payment via Phase 07 addPayment works
- [ ] end-to-end verified (stock + movements + payable + aging)

## Success Criteria
- Supplier intake of mixed serialized + quantity lines: inventory increases, one `stock_movements` row per unit/line (type 'in'), one payable `debt` (direction='payable', supplierId set, customerId null, amount=Σ cost, due=receiptDate+terms).
- Dup serial mid-intake rolls back entirely: no stock change, no movements, no debt.
- Paid-in-full-at-receipt intake creates NO debt.
- Payable list/aging show only payables; receivable views unaffected.
- Partial supplier payment → status partial + outstanding reduced (reused Phase 07 addPayment).

## Risk Assessment
- **Non-atomic intake (HIGH):** stock written but debt fails (or vice-versa). Mitigate: single wrapping transaction; movements + payable inside it.
- **Phase 03 primitive change breaks v1 (MED):** extending intakeSerialized signature. Mitigate: optional param + same return shape; existing callers unaffected.
- **Direction filter regresses Phase 07 receivables (MED):** Mitigate: default `direction='receivable'`; add tests for both.
- **Cost total mismatch (LOW):** server recomputes total from lines; never trust client total.
- **Grouping without receipt header (LOW):** rely on batchId + notes; acceptable for v2 (see Q2). Revisit if a "view full receipt" screen is requested.

## Security Considerations
- Server-side validate: positive qty/cost, serials non-empty for SERIALIZED, supplierId active.
- Enforce payable invariant: supplierId set, customerId null (per phase-01 repo guard).
- Block payment > outstanding (Phase 07 rule, reused).
- Drizzle parameterized throughout.

## Next Steps
- Optional v2.1: dashboard KPI "tổng công nợ phải trả NCC" (reuse Phase 08 aging summary with direction='payable').
- If GL/tax later: revisit AR/AP table split (noted dissent in plan.md).
