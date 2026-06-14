# Supplier Goods-Intake + Accounts-Payable (Công Nợ Phải Trả NCC) — v2

- **Date:** 2026-06-13
- **Status:** Planned (deferred — NOT v1 MVP)
- **Scope:** SIMPLIFIED. One-step: pick NCC + products → receive into stock → record payable debt. Happy path only.

## Relationship to main plan
SUPPLEMENTS `../260613-ebike-shop-crm-mvp/`. Does NOT duplicate it. Builds on:
- Phase 02 schema (`debts`, `debt_payments`, `products`, `inventory_units`) — source of truth.
- Phase 03 intake mechanics (`intakeSerialized`, `adjustQuantity`) — EXTENDED, not reinvented.
- Phase 07 debt views/aging — REUSED with a `direction` filter.
Depends on main v1 shipping all 5 modules first.

## Schema changes to main plan (flag for v1 build)
**DECIDED 2026-06-13:** do NOT touch v1 plan now — these land as a **v2 migration**. v1 ships `debts` as-is (`customerId` NOT NULL, no direction). v2 Phase 01 performs the SQLite table-rebuild migration (NOT NULL→nullable) — accepted cost. Changes:
1. `debts.customerId` → make **nullable** (was NOT NULL).
2. `debts` += `direction` enum `['receivable','payable']` NOT NULL default `'receivable'`.
3. `debts` += `supplierId` integer **nullable** FK → suppliers.id.
4. `debt_payments` — **NO CHANGE** (keyed by debtId; direction-agnostic — confirmed against Phase 02).
5. NEW table `suppliers` (minimal).
6. NEW table `stock_movements` (minimal ledger — Phase 03 currently records none; see phase-01).
7. `inventory_units` += `supplierId` nullable FK (provenance; optional, justified in phase-02 file).
Detail + exact column defs + Drizzle migration: see phase files.

## Research dissent (rejected)
Research recommends SEPARATE `supplier_debts` + `goods_receipts`/`receipt_items` (Oracle/NetSuite GL pattern). REJECTED for single-shop scale w/ no GL/accounting. Honoring user's single-`debts`-table + `direction` flag (DRY). One-line noted trade-off: *if accounting/GL/tax-compliance is ever added, revisit splitting AR/AP into separate tables.*

## Phases
1. `phase-01-suppliers-and-schema.md` — suppliers table + CRUD UI + `debts` schema changes (direction + supplierId) + `stock_movements` table + Drizzle migration.
2. `phase-02-goods-intake-and-payable.md` — supplier intake (extends Phase 03): pick supplier + items + cost → atomic txn (inventory + stock_movements + auto-create payable debt). Payable views/aging reuse Phase 07 with direction filter.

## YAGNI / out of scope (user rejected)
- PO header/status lifecycle ("gửi NCC / chờ giao").
- QC valid/invalid branch.
- "Khiếu nại NCC / trả lại / điều chỉnh PO" (returns/claims/adjustments).
- Separate `supplier_debts`/`goods_receipts`/`receipt_items` tables (research over-engineering).
- supplier tax_id, discounts, default_payment_method, landed costs, multi-location, GL accounts.
Only happy path: receive → stock → payable.

## Dependencies
- Main v1 complete (Phases 01-08 of MVP plan).
- No new npm deps (reuses Drizzle, Mantine, dayjs).

## Decisions (locked 2026-06-13)
1. **Do NOT modify v1 plan now.** `debts` direction-awareness lands as a v2 migration (table rebuild accepted). [user: "chưa cần"]
2. **Goods-receipt grouping = `batchId`/`refId` on stock_movements + payable `notes`.** No receipt header table. (default accepted)
3. **Add `inventory_units.supplierId` (nullable)** for provenance. (default accepted)
4. **Editing/voiding a posted intake = OUT of scope v2.** Manual fix via Phase 03 `adjustQuantity` + manual debt edit. (default accepted)
5. **Payable `dueDate` = receiptDate + COALESCE(paymentTermsDays, 0)** (null/0 ⇒ due immediately). (default accepted)
