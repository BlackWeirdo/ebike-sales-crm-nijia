# Phase 04 — POS / Sales Module

## Context Links
- Overview: [plan.md](./plan.md)
- Domain model (dual-mode sale_items, money): [../research/researcher-02-domain-model.md](./research/researcher-02-domain-model.md)
- Depends on: [phase-03-inventory.md](./phase-03-inventory.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Completes the core VERTICAL SLICE. Cart-based checkout: search product, pick a serialized unit OR enter qty for stock, link customer (optional), apply discount, record deposit/partial payment, then atomically create the sale → mark unit sold / decrement stock. On bike sale, trigger warranty + reminder creation (Phase 06 hook) and debt creation if underpaid (Phase 07 hook).
- **Priority:** High (slice completion / proves architecture)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Sale creation MUST be ONE transaction: insert sale + items, update unit status/qty, (optionally) create warranties + reminder + debt. If anything fails → rollback (no half-sold inventory).
- sale_items dual-mode: serialized line → `inventoryUnitId` set, `qty=1`; stock line → `productId`+`qty`.
- Money math integer: `lineTotal = unitPrice*qty - lineDiscount`; `subtotal = Σ lineTotal`; `total = subtotal - saleDiscount`; `outstanding = total - paid`.
- If `paid < total` AND customer linked → create debt (Phase 07 logic invoked here). If no customer → block partial (cash sale must be fully paid) — friendly error.
- Reserved status optional; v1 skip reservation (YAGNI) — pick unit at checkout directly.

## Requirements
### Functional
- Search/add products to cart. For SERIALIZED, choose a specific in_stock unit (serial dropdown). For QUANTITY, enter qty (≤ available).
- Per-line discount; sale-level discount.
- Optional customer link (search/create inline).
- Payment: method + amount paid (supports deposit < total).
- Submit → creates sale, decrements/sold inventory, returns sale id + summary.
- Post-sale: offer "In phiếu bảo hành" (→ Phase 06) when bike sold.
- Sales list/history view with detail.

### Non-Functional
- Atomic transaction. Re-validate stock at submit (avoid overselling).
- Integer money; display formatted.

## Architecture
- UI: `PosPage` → `ProductSearch` + `Cart` + `CustomerPicker` + `PaymentPanel` + `Summary`. Cart state in React (useReducer).
- IPC: `sales:create`, `sales:list`, `sales:get`, `products:searchAvailable`.
- Main `createSale` orchestrates txn + calls warranty/reminder/debt helpers.

## Core Transaction (pseudocode `src/main/repos/sales.ts`)
```ts
createSale(dto) {
  return getSqlite().transaction(() => {
    // 1. validate
    if (dto.paidVnd < dto.totalVnd && !dto.customerId)
      throw new Error('Bán nợ phải chọn khách hàng')
    // 2. insert sale
    const sale = db.insert(sales).values({...}).run(); const saleId = sale.lastInsertRowid
    // 3. items + inventory
    for (const line of dto.items) {
      if (line.inventoryUnitId) {                 // serialized
        const u = unitsRepo.get(line.inventoryUnitId)
        if (!u || u.status !== 'in_stock') throw new Error('Xe đã bán/không khả dụng')
        db.update(inventoryUnits).set({ status:'sold', soldOnDate: dto.saleDate })
          .where(eq(inventoryUnits.id, line.inventoryUnitId)).run()
      } else {                                    // stock
        const p = productsRepo.get(line.productId)
        if (p.qtyOnHand < line.qty) throw new Error(`Thiếu tồn: ${p.name}`)
        db.update(products).set({ qtyOnHand: p.qtyOnHand - line.qty })
          .where(eq(products.id, line.productId)).run()
      }
      db.insert(saleItems).values({ saleId, ...line }).run()
    }
    // 4. warranties + reminder for each serialized bike line (Phase 06 helper)
    createWarrantiesForSale(saleId, dto)         // frame+battery rows + next_service_date
    // 5. debt if underpaid (Phase 07 helper)
    if (dto.paidVnd < dto.totalVnd)
      createDebtForSale(saleId, dto.customerId, dto.totalVnd - dto.paidVnd, dto.dueDate)
    return { saleId }
  })()   // run txn now
}
```
> NOTE: keep warranty/debt helpers as separate functions so Phases 06/07 fill them in; in Phase 04 stub them to no-op, then wire fully later. Document this clearly.

## Related Code Files
**Create:**
- `src/renderer/src/features/pos/PosPage.tsx`
- `.../pos/{ProductSearch,Cart,CustomerPicker,PaymentPanel,SaleSummary}.tsx`
- `.../pos/cartReducer.ts` (add/remove/update line, totals)
- `.../sales/SalesHistoryPage.tsx`, `SaleDetailModal.tsx`
- `src/main/repos/sales.ts` (createSale txn, list, get)
- `src/main/ipc/sales.ts`
- `src/main/repos/_hooks.ts` — `createWarrantiesForSale` (stub), `createDebtForSale` (stub)
- `src/shared/types.ts` (SaleDto, SaleLineDto, SaleSummary) — extend
**Modify:**
- `src/main/repos/inventory.ts` (`searchAvailable`: products + in_stock unit options)
- preload/index.ts, index.d.ts

## Implementation Steps
1. `searchAvailable(q)`: return products matching q with availability (serialized → list in_stock units{id,serial}; quantity → qtyOnHand).
2. cartReducer: line = {productId, type, inventoryUnitId?, name, qty, unitPriceVnd, lineDiscountVnd}; compute lineTotal; selectors for subtotal/total.
3. `PaymentPanel`: method select; paidVnd input (default = total); if paid<total show "Bán nợ — chọn khách + ngày đến hạn". dueDate default = saleDate+30 (open Q5).
4. `createSale` txn exactly as pseudocode. Re-validate stock inside txn.
5. Stub `createWarrantiesForSale`/`createDebtForSale` returning void; mark `// TODO Phase 06/07`.
6. After success: notification + if any serialized bike line → button "In phiếu bảo hành" (disabled until Phase 06).
7. `SalesHistoryPage`: table (date, customer, total, paid, outstanding badge). Detail modal shows items + serials.

## Todo List
- [ ] searchAvailable (units for serialized, qty for stock)
- [ ] cartReducer + totals (integer math)
- [ ] CustomerPicker (search + inline create)
- [ ] PaymentPanel (partial/deposit, debt gate)
- [ ] createSale single transaction (sale+items+inventory)
- [ ] re-validate stock inside txn (no oversell)
- [ ] warranty/debt helper stubs wired into txn
- [ ] post-sale print button (stub)
- [ ] SalesHistory + detail

## Success Criteria
- **SLICE PROVEN:** intake 1 bike (Phase 03) → sell to a customer with deposit < total → unit becomes `sold`, stock count drops, sale + items saved, history shows outstanding.
- Selling more stock qty than available → blocked with error, nothing committed.
- Cash sale (no customer) with paid<total → blocked.
- Totals match hand calc (integer VND).

## Risk Assessment
- **Oversell race (LOW, single-user but still):** Mitigate: re-check status/qty inside txn.
- **Partial commit (HIGH if not txn):** Mitigate: everything in one `transaction()`.
- **Helper stubs forgotten (MED):** Mitigate: explicit TODO + Phase 06/07 success criteria re-verify the slice.

## Security Considerations
- Validate numeric inputs server-side (no negative qty/price/discount; discount ≤ line/total).
- Enforce business rule (debt requires customer) in main, not just UI.

## Next Steps
- Phase 05 reads sale history per customer. Phase 06 fills warranty helper + print. Phase 07 fills debt helper + payments.
