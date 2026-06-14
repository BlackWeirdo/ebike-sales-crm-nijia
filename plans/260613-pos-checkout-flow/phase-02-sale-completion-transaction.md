# Phase 02 — Sale-Completion Transaction (atomic createSale)

## Context Links
- This plan: [plan.md](./plan.md)
- Research (atomic pattern, discount, partial→debt): [research/researcher-01-checkout-transaction.md](./research/researcher-01-checkout-transaction.md)
- REFINES main: [../260613-ebike-shop-crm-mvp/phase-04-pos-sales.md](../260613-ebike-shop-crm-mvp/phase-04-pos-sales.md) (createSale skeleton + `_hooks.ts`)
- Schema: [../260613-ebike-shop-crm-mvp/phase-02-database-schema.md](../260613-ebike-shop-crm-mvp/phase-02-database-schema.md)
- Helpers filled by: main [phase-06](../260613-ebike-shop-crm-mvp/phase-06-warranty-maintenance.md) / [phase-07](../260613-ebike-shop-crm-mvp/phase-07-debt.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Detail the ONE atomic `createSale` transaction (Drizzle over better-sqlite3, SYNC `getSqlite().transaction(fn)()`): re-validate → insert `sales` + `sale_items` → decrement stock / mark serialized unit `sold` → invoke warranty helper (frame+battery) → auto-create debt if underpaid. Rollback on any throw. EXTENDS the `createSale` skeleton already in main Phase 04 (`src/main/repos/sales.ts`); this phase makes the math, validation, and partial→debt explicit. Does NOT redefine the file — refines it.
- **Priority:** Critical (slice completion)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- better-sqlite3 transactions are SYNC — entire fn runs atomically; any throw → auto-rollback. Use `getSqlite().transaction(fn)()` (call returned wrapper). Do NOT use Drizzle `async` tx with better-sqlite3 here (main plan + research §1 favor sync).
- Authoritative money math lives HERE, not renderer. Recompute subtotal from line `unitPriceVnd*qty`; recompute `discountVnd`/`totalVnd`; ignore any renderer-sent total.
- Dual-mode line: `inventoryUnitId` set → serialized (qty forced 1, mark unit sold); else `productId`+`qty` → decrement `products.qtyOnHand`.
- Re-validate INSIDE txn (unit still `in_stock`; `qtyOnHand ≥ qty`) → prevents oversell.
- Warranty + debt run via the SAME txn through main `_hooks.ts` helpers; if still stubbed (no-op), sale+inventory still commit correctly.
- **C2:** at sale we DO NOT insert a `debt_payments` row (research did). `paidVnd` lives on `sales`; `debts.amountVnd = total - paid`. First payment row only later via Phase 07 `addPayment`.
- **C1:** reject any `paymentMethod` not in `['cash','transfer']` for v1 (`mixed` reserved, trả-góp never reaches here).

## Requirements
### Functional
- Validate dto: non-empty items; valid enum payment method; `discountVnd ≥ 0` and `< subtotal`; `paidVnd ≥ 0`; partial requires `customerId`.
- Insert sale with recomputed `subtotalVnd/discountVnd/totalVnd/paidVnd`.
- Per line: insert `sale_items` (with `lineTotalVnd`), update inventory (unit→sold / qty−).
- On serialized bike line → `createWarrantiesForSale` (main Phase 06).
- If `paidVnd < totalVnd` → `createDebtForSale` (main Phase 07).
- Return `{ saleId, totalVnd, paidVnd, outstandingVnd }` for invoice (Phase 03).
### Non-Functional
- Fully atomic; rollback leaves DB unchanged.
- Integer VND only. No floats.
- Throws are Vietnamese, user-friendly (surface to UI).

## Architecture (data flow)
```
window.api.sales.create(dto)
  → ipcMain.handle('sales:create')  [src/main/ipc/sales.ts]
  → salesRepo.createSale(dto)        [src/main/repos/sales.ts]  (REFINED HERE)
       getSqlite().transaction(() => {
         validate → insert sale → loop items (sale_items + inventory)
         → createWarrantiesForSale(saleId,dto)   [_hooks.ts → Phase 06]
         → if underpaid createDebtForSale(...)    [_hooks.ts → Phase 07]
       })()
  → return summary  → UI post-sale actions
```

## createSale (authoritative pseudocode — refines main Phase 04 snippet)
```ts
// src/main/repos/sales.ts
import { getSqlite, db } from '../db/connection'
import { sales, saleItems, products, inventoryUnits } from '../db/schema'
import { eq } from 'drizzle-orm'
import { createWarrantiesForSale, createDebtForSale } from './_hooks'

const ACTIVE = ['cash', 'transfer'] as const

export function createSale(dto: SaleDto) {
  return getSqlite().transaction(() => {
    // 1) VALIDATE -------------------------------------------------------
    if (!dto.items?.length) throw new Error('Giỏ hàng trống')
    if (!ACTIVE.includes(dto.paymentMethod))
      throw new Error('Phương thức thanh toán không khả dụng (v1)')

    // 2) RECOMPUTE MONEY (authoritative — ignore renderer total) ---------
    let subtotalVnd = 0
    const lines = dto.items.map((l) => {
      const qty = l.inventoryUnitId ? 1 : l.qty
      if (qty <= 0 || l.unitPriceVnd < 0) throw new Error('Số lượng/đơn giá không hợp lệ')
      const lineTotalVnd = qty * l.unitPriceVnd          // no per-item discount in this flow
      subtotalVnd += lineTotalVnd
      return { ...l, qty, lineTotalVnd }
    })
    const discountVnd =
      dto.discountMode === 'pct'
        ? Math.floor(subtotalVnd * dto.discountValue / 100)   // truncate remainder
        : (dto.discountVnd ?? 0)                              // fixed VND
    if (discountVnd < 0 || discountVnd >= subtotalVnd) throw new Error('Giảm giá không hợp lệ')
    const totalVnd = subtotalVnd - discountVnd
    const paidVnd  = dto.paidVnd ?? totalVnd
    if (paidVnd < 0) throw new Error('Số tiền trả không hợp lệ')
    if (paidVnd < totalVnd && !dto.customerId)
      throw new Error('Bán nợ phải chọn khách hàng')

    // 3) INSERT SALE ----------------------------------------------------
    const res = db.insert(sales).values({
      customerId: dto.customerId ?? null,
      saleDate: dto.saleDate,                    // ISO YYYY-MM-DD set by handler/repo
      subtotalVnd, discountVnd, totalVnd, paidVnd,
      paymentMethod: dto.paymentMethod,
      notes: dto.notes ?? null,
    }).run()
    const saleId = Number(res.lastInsertRowid)

    // 4) ITEMS + INVENTORY (dual-mode, re-validate to avoid oversell) ----
    for (const l of lines) {
      if (l.inventoryUnitId) {                   // serialized
        const u = db.select().from(inventoryUnits)
          .where(eq(inventoryUnits.id, l.inventoryUnitId)).get()
        if (!u || u.status !== 'in_stock') throw new Error('Xe đã bán / không khả dụng')
        db.update(inventoryUnits)
          .set({ status: 'sold', soldOnDate: dto.saleDate })
          .where(eq(inventoryUnits.id, l.inventoryUnitId)).run()
      } else {                                   // quantity
        const p = db.select().from(products).where(eq(products.id, l.productId)).get()
        if (!p) throw new Error('Sản phẩm không tồn tại')
        if (p.qtyOnHand < l.qty) throw new Error(`Thiếu tồn: ${p.name}`)
        db.update(products).set({ qtyOnHand: p.qtyOnHand - l.qty })
          .where(eq(products.id, l.productId)).run()
      }
      db.insert(saleItems).values({
        saleId, productId: l.productId, inventoryUnitId: l.inventoryUnitId ?? null,
        qty: l.qty, unitPriceVnd: l.unitPriceVnd, lineDiscountVnd: 0,
        lineTotalVnd: l.lineTotalVnd,
      }).run()
    }

    // 5) WARRANTY (main Phase 06 helper; no-op if still stubbed) ---------
    createWarrantiesForSale(saleId, { ...dto, items: lines })

    // 6) PARTIAL → DEBT (main Phase 07 helper; NO debt_payment row here) -
    if (paidVnd < totalVnd)
      createDebtForSale(saleId, dto.customerId!, totalVnd - paidVnd, dto.dueDate)

    return { saleId, totalVnd, paidVnd, outstandingVnd: totalVnd - paidVnd }
  })()   // ← invoke the transaction wrapper now (sync)
}
```

### Discount math summary
- `%`: `discountVnd = floor(subtotal * pct/100)` (truncate; open-Q2 confirm rounding). `total = subtotal − discountVnd`.
- `fixed`: `discountVnd = input`; `total = subtotal − discountVnd`. Guard `0 ≤ discountVnd < subtotal`.

### Partial → debt
`outstanding = total − paid`. If `> 0`: requires customer, `createDebtForSale(saleId, customerId, outstanding, dueDate)` inside txn (atomic with sale). `debts.amountVnd = outstanding`, status `'open'`. NO `debt_payments` row at sale (C2).

### Idempotency / rollback
- Rollback automatic on any throw (sync better-sqlite3) — no orphan sale/sold-unit.
- No dedup table (single-user; UI submit-guard in Phase 01 is sufficient — YAGNI).

## Related Code Files
**Modify (REFINE main artifacts — do NOT recreate):**
- `src/main/repos/sales.ts` — flesh out `createSale` per above (main Phase 04 has the skeleton). OVERLAP.
- `src/main/ipc/sales.ts` — `sales:create` sets `saleDate` (ISO today) if absent, forwards dto. OVERLAP.
- `src/shared/types.ts` — `SaleDto` add `discountMode?:'pct'|'vnd'`, `discountValue?`, `discountVnd?`, `dueDate?`; `SaleResult { saleId,totalVnd,paidVnd,outstandingVnd }`. OVERLAP.
**Depends-on (filled by main 06/07 — leave as helper calls):**
- `src/main/repos/_hooks.ts` — `createWarrantiesForSale`, `createDebtForSale` (stub in Phase 04, real in 06/07).

## Implementation Steps
1. Extend `SaleDto`/`SaleResult` in `src/shared/types.ts`.
2. In `sales:create` IPC handler, default `saleDate = dayjs().format('YYYY-MM-DD')` if not provided.
3. Refine `createSale` exactly per pseudocode: validate → recompute money → insert sale.
4. Loop lines: dual-mode inventory update with in-txn re-validation; insert `sale_items` w/ `lineTotalVnd`.
5. Call `createWarrantiesForSale` (works as no-op until Phase 06).
6. Underpaid → `createDebtForSale` (no-op until Phase 07). Confirm NO `debt_payments` insert here.
7. Return summary object for Phase 03 invoice.
8. Manual test rollback: force a throw on the 2nd line → assert sale row + 1st unit revert (nothing committed).

## Todo List
- [ ] SaleDto/SaleResult extended (discount fields)
- [ ] handler sets saleDate ISO default
- [ ] validate (items, enum, discount<subtotal, partial→customer)
- [ ] authoritative recompute (subtotal/discount/total)
- [ ] insert sale + dual-mode items + inventory in one txn
- [ ] in-txn re-validation (no oversell)
- [ ] warranty helper call (atomic)
- [ ] partial→debt call (no debt_payment row)
- [ ] rollback verified (forced-throw test)

## Success Criteria
- Sell bike with deposit < total → unit `sold`, sale+items saved, debt row = outstanding, summary returned.
- Discount 10% on 500,000 → stored discountVnd=50,000, totalVnd=450,000.
- Oversell qty / already-sold unit → throws, nothing committed.
- Cash sale no customer with paid<total → blocked.
- No `debt_payments` row created at checkout (C2 honored).

## Risk Assessment
- **Partial commit (HIGH if not txn):** Mitigate: everything inside one sync `transaction()`.
- **Renderer total trusted (MED):** Mitigate: recompute here; ignore renderer total.
- **Helper divergence with 06/07 (MED):** Mitigate: keep helper signatures identical to main; mark TODO; 06/07 success criteria re-verify slice.
- **Drizzle async-tx misuse (LOW):** Mitigate: use SYNC `getSqlite().transaction(fn)()`, not `await db.transaction`.

## Security Considerations
- Server-side numeric validation (no negative qty/price/discount; discount < subtotal; paid ≥ 0).
- Enforce business rules in main (debt requires customer; v1 payment methods) — never rely on UI.
- Drizzle parameterizes; never string-concat user input.

## Next Steps
- Phase 03 renders the returned `SaleResult` + line data into an invoice PDF.
