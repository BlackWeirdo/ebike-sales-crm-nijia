# Phase 01 — Checkout UI Flow

## Context Links
- This plan: [plan.md](./plan.md)
- Research: [research/researcher-01-checkout-transaction.md](./research/researcher-01-checkout-transaction.md) (discount math, installment stub)
- REFINES main: [../260613-ebike-shop-crm-mvp/phase-04-pos-sales.md](../260613-ebike-shop-crm-mvp/phase-04-pos-sales.md)
- Schema: [../260613-ebike-shop-crm-mvp/phase-02-database-schema.md](../260613-ebike-shop-crm-mvp/phase-02-database-schema.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Refine the POS renderer flow: customer search → add cart lines → MANUAL sale-level discount (% or fixed VND) → LIVE total → payment-method selector (cash/transfer active, trả góp disabled stub) → submit with double-submit guard. EXTENDS main Phase 04 UI files (`PosPage`, `Cart`, `CustomerPicker`, `PaymentPanel`, `SaleSummary`, `cartReducer`); does not redefine them.
- **Priority:** High
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Discount = SALE-LEVEL ONLY, MANUAL. One mode at a time via radio: `%` OR `fixed VND`. No per-item discount in this flow (main schema keeps `lineDiscountVnd` but checkout UI does not expose it — see C-note).
- Live total recomputed in `cartReducer` selectors, integer VND, on every cart/discount change. UI is display-only; main re-derives + validates at submit (never trust renderer math).
- Installment = visibly DISABLED radio, tooltip "Sắp có ở v2". It is never selectable, never submitted. NO enum value added (Conflict C1).
- Double-submit guard: disable Submit while in-flight + ignore repeat clicks; single-user so no server dedup table (YAGNI).
- Partial payment (`paid < total`) is allowed ONLY when a customer is linked (else friendly block — main rule C4).

## Requirements
### Functional
- Customer: search existing (name/phone) or inline-create; optional for full-paid cash sale, REQUIRED if partial.
- Cart: add serialized unit (pick in_stock serial) or quantity line (qty ≤ available). Show line total.
- Discount control: toggle %/VND; numeric input; validated `0 ≤ discount`, `discountVnd < subtotal`.
- Summary panel: subtotal, discount amount (derived), total, paid input (default = total), outstanding.
- Payment selector: radios `Tiền mặt` / `Chuyển khoản` (active); `Trả góp (Sắp có ở v2)` disabled.
- Submit → calls `window.api.sales.create(dto)`; on success show summary + post-sale actions (print invoice; "In phiếu bảo hành" if bike).
### Non-Functional
- Integer VND throughout; format with `toLocaleString('vi-VN')` for display only.
- Submit idempotent at UI level (guard); no duplicate sale on rapid double-click.
- All amounts re-validated in main (Phase 02 here).

## Architecture (data flow)
```
PosPage
 ├─ CustomerPicker  → customerId (nullable)
 ├─ ProductSearch   → dispatch(addLine)
 ├─ Cart (cartReducer state) → lines[], selectors: subtotal
 ├─ DiscountControl → {mode:'pct'|'vnd', value} → selector: discountVnd, total
 ├─ PaymentPanel    → {method:'cash'|'transfer', paidVnd}
 └─ SaleSummary     → subtotal/discount/total/paid/outstanding
        │ submit (guarded)
        ▼ window.api.sales.create(SaleDto) → main createSale (Phase 02 here)
```
Discount math (renderer mirror of main, see Phase 02 for authoritative):
```ts
const subtotalVnd = lines.reduce((s,l)=> s + l.qty*l.unitPriceVnd, 0)
const discountVnd = mode==='vnd' ? value : Math.floor(subtotalVnd * value/100)
const totalVnd    = subtotalVnd - discountVnd
const outstanding = totalVnd - paidVnd
```

## Related Code Files
**Modify (EXTEND main Phase 04 — do NOT recreate):**
- `src/renderer/src/features/pos/PosPage.tsx` — orchestrate flow + submit guard
- `src/renderer/src/features/pos/cartReducer.ts` — add discount mode/value to state + total selectors
- `src/renderer/src/features/pos/PaymentPanel.tsx` — add discount control + disabled trả-góp radio
- `src/renderer/src/features/pos/SaleSummary.tsx` — show derived discount/total/outstanding
- `src/shared/types.ts` — extend `SaleDto` with `discountMode?`/`discountVnd` (final discountVnd is what crosses IPC)
**Create:**
- `src/renderer/src/features/pos/DiscountControl.tsx` (small; could inline in PaymentPanel — KISS, create only if PaymentPanel gets crowded)
- `src/shared/payment-methods.ts` — `ACTIVE_PAYMENT_METHODS=['cash','transfer']`; UI option list incl. disabled trả-góp (NO new enum value)
**OVERLAP flags:** `cartReducer`, `PaymentPanel`, `SaleSummary`, `SaleDto` are main-Phase-04 artifacts. Keep field names consistent with main schema (`discountVnd`, `paidVnd`, `totalVnd`).

## Implementation Steps
1. Extend `cartReducer` state: `{ lines, discount:{mode:'pct'|'vnd', value:number} }`. Add selectors `selectSubtotal`, `selectDiscountVnd`, `selectTotal`.
2. Build `DiscountControl`: segmented `%`/`VND` + number input. Clamp negatives. On change → dispatch `setDiscount`.
3. In `SaleSummary` show subtotal, `-discount`, **total**, paid input (default total), outstanding (red if >0).
4. In `PaymentPanel` add payment radios from `src/shared/payment-methods.ts`; render trả-góp option `disabled` with tooltip "Sắp có ở v2", opacity 0.5.
5. Validation before enabling Submit: cart non-empty; `discountVnd < subtotal`; if `paidVnd < totalVnd` then `customerId` required (else show "Bán nợ phải chọn khách hàng").
6. Submit guard: `const [submitting,setSubmitting]` — disable button + early-return if already submitting; reset in finally.
7. Build `SaleDto` (customerId, saleDate, items[], discountVnd, paymentMethod, paidVnd, dueDate?) → `window.api.sales.create`.
8. On success: toast + show post-sale actions: `In hóa đơn` (Phase 03) and `In phiếu bảo hành` (main Phase 06; disabled until then).

## Todo List
- [ ] cartReducer: discount mode/value + total selectors (integer)
- [ ] DiscountControl (%/VND toggle, clamp)
- [ ] SaleSummary shows subtotal/discount/total/outstanding
- [ ] PaymentPanel radios; trả-góp disabled + tooltip (no enum value)
- [ ] partial-payment-requires-customer gate (UI)
- [ ] double-submit guard
- [ ] SaleDto built + create() wired
- [ ] post-sale action buttons (print invoice / warranty)

## Success Criteria
- Add lines → live total updates instantly; matches hand calc (integer VND).
- 10% on 500,000 → discount 50,000, total 450,000.
- Trả góp radio visible but unclickable, labeled v2.
- Partial pay without customer → blocked with Vietnamese message; with customer → allowed.
- Rapid double-click Submit creates exactly ONE sale.

## Risk Assessment
- **Renderer/main math drift (MED):** UI total ≠ main total. Mitigate: main recomputes authoritatively (Phase 02), UI is display-only; share the discount formula constant.
- **Double-submit (MED):** Mitigate: in-flight guard; main also atomic so worst case one extra is prevented at UI.
- **Discount > total (LOW):** Mitigate: validate `discountVnd < subtotal` both UI + main.

## Security Considerations
- Treat all renderer numbers as untrusted; main re-validates (no negative qty/price/discount; discount < subtotal).
- Escape customer/product text where rendered into invoice later (Phase 03).

## Next Steps
- Phase 02 consumes `SaleDto` in the atomic `createSale`. Phase 03 wires the print-invoice button.
