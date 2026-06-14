# POS Sale-Checkout Completion Flow — Refinement Plan

**Date:** 2026-06-13 | **Status:** Not Started | **Type:** REFINEMENT of main-plan Phase 04 (+touches 06/07)

## What this is
Detailed drill-down of the POS checkout COMPLETION flow only. This SUPPLEMENTS the main MVP plan — it does NOT replace it. It refines `phase-04-pos-sales.md` and touches the helper seams in Phase 06 (warranty) / Phase 07 (debt). Read the main plan files first; this doc details only the flow steps below.

## Flow (from user flowchart)
1. Find customer + add products; apply MANUAL sale-level discount (% or fixed VND).
2. Confirm order total (live).
3. Pick payment method → branch: **cash / transfer** (collect + record, partial allowed → auto-debt); **trả góp = DISABLED stub "Sắp có ở v2"**.
4. Print invoice/receipt (HTML → `printToPDF`, A5/A4, save copy to userData).
5. Atomically update inventory: qty / serial unit→sold / auto-create frame+battery warranty rows on bike sale.

## Relationship to main plan (avoid divergence)
- **Schema source of truth = main `phase-02-database-schema.md`.** Use its column names (`subtotalVnd, discountVnd, totalVnd, paidVnd`) and enum `paymentMethod ∈ ['cash','transfer','mixed']`. IGNORE the research file's variant names (`paid_amount_vnd`, `installment_deferred`, etc.) — see Conflicts.
- `createSale` txn, `_hooks.ts` stubs, POS UI files are ALREADY defined in main Phase 04. This plan EXTENDS them; phases say "extends/refines main Phase 04 file X" rather than redefining.
- Warranty/debt creation stay in the SAME txn via the Phase 06/07 helpers (already wired as stubs in Phase 04).

## CONFLICTS to keep dev in sync (resolve toward MAIN plan)
- **C1 payment enum:** research `installment_deferred` vs main `['cash','transfer','mixed']`. → DO NOT add an installment enum value. Trả góp is a UI-only disabled radio; never submitted. Keep enum as main plan.
- **C2 debt_payments at sale:** research inserts a `debt_payments` row at checkout. Main plan does NOT — at sale, paid amount lives on `sales.paidVnd`; `debts.amountVnd = total - paid`; first `debt_payments` row only via Phase 07 `addPayment`. → Follow MAIN (no debt_payment row at checkout).
- **C3 column names:** use camelCase Drizzle fields from main schema, not the snake_case in research SQL.
- **C4 cash-sale-no-customer:** main rule = partial requires a customer (block walk-in debt). Keep it.

## Phases
| # | Phase | File | Status |
|---|-------|------|--------|
| 01 | Checkout UI flow (cart, customer, discount, total, payment selector, submit guard) | [phase-01-checkout-ui-flow.md](./phase-01-checkout-ui-flow.md) | Not Started |
| 02 | Sale-completion transaction (atomic createSale + discount math + partial→debt) | [phase-02-sale-completion-transaction.md](./phase-02-sale-completion-transaction.md) | Not Started |
| 03 | Invoice/receipt print (HTML → printToPDF, A5/A4, save to userData) | [phase-03-invoice-print.md](./phase-03-invoice-print.md) | Not Started |

## Dependencies
- Hard dep on main Phase 02 (schema/repos/IPC) + Phase 03 (inventory) + Phase 04 (POS shell, `createSale` skeleton).
- Phase 02 here invokes main Phase 06/07 helpers (`createWarrantiesForSale`, `createDebtForSale`); if those still stubbed, txn still commits sale+inventory (stubs are no-ops). Full warranty/debt land with main 06/07.
- Phase 03 here (print) overlaps main Phase 06 `src/main/print.ts` — SHARE that module, add an invoice template alongside warranty slip.

## YAGNI / out of scope
Installment/trả góp logic + tables (v2 stub only), interest/fees, promo-code/voucher, per-item discount (sale-level only), VAT/tax, thermal/ESC-POS, multi-currency, idempotency dedup table (single-user; use UI submit-guard instead).

## Unresolved questions
1. **Discount input precedence:** if operator types both % and fixed, which wins? Plan default: one mode toggle (radio %/VND), not both at once.
2. **Rounding on %:** `floor` to integer VND (truncate remainder) — confirm acceptable vs round-nearest.
3. **due_date at checkout:** manual field, fallback saleDate+30 (mirrors main open-Q4). Confirm default N=30.
4. **Invoice auto-print vs save-only:** default = silent save PDF to userData + on-screen "open PDF" button; no auto physical print in v1. Confirm.
5. **Invoice numbering:** use `sales.id` as invoice no., or separate human-friendly sequence? Plan default: `sales.id`.
6. **Mixed payment:** enum has `'mixed'` — does v1 UI expose it, or only cash/transfer? Plan default: cash/transfer radios only; `mixed` reserved, not shown.
