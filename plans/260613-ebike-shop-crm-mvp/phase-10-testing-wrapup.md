# Phase 10 — Manual Test Checklist + Final Wrap-Up

## Context Links
- Overview: [plan.md](./plan.md)
- All phases 01-09.

## Overview
- **Date:** 2026-06-13
- **Description:** Lightweight QA for v1 (KISS — no heavy test framework). A thorough manual test checklist covering every module + the end-to-end vertical slice, PLUS a few Vitest unit tests for the pure logic most likely to have bugs (money math, debt aging buckets, warranty end-date). Final wrap-up report.
- **Priority:** High (gate to "done")
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Beginner + single-user app → full automated coverage is over-engineering (YAGNI). Manual checklist catches UI/flow bugs cheaply.
- BUT pure functions with off-by-one / rounding risk deserve unit tests: VND line/total math, aging bucket boundaries (0/30/31/60/61/90/91), warranty `end_date` add-months, payment status transitions. Extract these into pure functions in `src/shared/` so they're testable WITHOUT Electron.
- Test the PACKAGED build (Phase 09), not just dev.

## Requirements
### Functional
- Documented manual test checklist; all items pass on installed build.
- Vitest configured; unit tests pass for money/aging/warranty-date/status logic.
- Final wrap-up report: what shipped, known limitations, restore/backup instructions, open questions.

### Non-Functional
- Tests run via `npm test` quickly. No E2E framework v1.

## Architecture
- Pure logic lives in `src/shared/` (no Electron import) → unit-testable.
- `vitest` config minimal; test files colocated `*.test.ts`.

## Pure functions to extract + test (`src/shared/`)
- `money.ts`: `lineTotal(unitPrice, qty, lineDiscount)`, `saleTotal(lineTotals, saleDiscount)`, `outstanding(amount, payments[])`.
- `dates.ts`: `warrantyEndDate(start, months)`, `isWarrantyActive(start, months, today)`.
- `aging.ts`: `agingBucket(dueDate, today)` → boundary tests at 0,1,30,31,60,61,90,91 days.
- `debtStatus.ts`: `debtStatus(amount, paidSum)` → open/partial/paid.

## Manual Test Checklist (run on installed build)
**Setup/shell**
- [ ] App launches; DB + backup created; no console errors.
**Inventory**
- [ ] Create SERIALIZED bike + intake 3 serials → stock 3.
- [ ] Dup serial intake rejected, no partial insert.
- [ ] Create QUANTITY accessory, +10 / -3 → 7. Negative blocked.
- [ ] Low-stock badge at/below threshold.
- [ ] Image upload + thumbnail.
**POS / Sales (the slice)**
- [ ] Sell bike to customer, deposit < total → unit sold, stock -1, sale saved, outstanding shown.
- [ ] Oversell stock blocked, nothing committed.
- [ ] Cash sale no-customer partial blocked.
- [ ] Totals = hand calc.
**Customers**
- [ ] Profile shows purchase, total spent, owned serial, outstanding, warranties, maintenance.
- [ ] Delete blocked when has sale.
**Warranty/Maintenance**
- [ ] Bike sale auto-creates frame+battery warranty + reminder, correct end dates.
- [ ] Lookup by serial → owner + statuses.
- [ ] Print A5 slip (PDF) correct; A4 option; real printer test.
- [ ] Mark maintenance done.
**Debt**
- [ ] Underpaid sale auto-creates debt; partial payment → partial; full → paid; over-payment blocked.
- [ ] Aging buckets correct (seed dates at boundaries).
**Dashboard**
- [ ] KPIs/chart/alerts match data; alert click navigates.
**Backup/Restore**
- [ ] Backup file present; restore brings data back.

## Related Code Files
**Create:**
- `vitest.config.ts`
- `src/shared/{money,dates,aging,debtStatus}.ts` (extract pure logic) + `*.test.ts`
- `plans/260613-ebike-shop-crm-mvp/reports/10-final-wrapup.md` (final report)
- `MANUAL-TEST-CHECKLIST.md` (repo root, for reuse)
**Modify:**
- repos using the logic → import from `src/shared/` (DRY: same code tested + used)
- `package.json`: `"test": "vitest run"`

## Implementation Steps
1. Refactor: move scattered money/date/aging/status math into `src/shared/` pure functions; have repos import them (DRY).
2. Install + configure Vitest. Write boundary unit tests (esp. aging days 0/1/30/31/60/61/90/91, warranty add-months across month-end, money no-float).
3. Run `npm test` → all green.
4. Execute full manual checklist on the Phase-09 installed build; log failures, fix, re-run.
5. Write `10-final-wrapup.md`: shipped scope, screenshots optional, known limitations, restore/backup guide, deferred items (claims, VAT, signing), open questions resolution.

## Todo List
- [ ] Extract pure logic to src/shared/, repos import it
- [ ] Vitest configured, `npm test` works
- [ ] Unit tests: money / aging boundaries / warranty date / debt status
- [ ] Manual checklist executed on installed build
- [ ] Bugs fixed + re-verified
- [ ] Final wrap-up report written

## Success Criteria
- `npm test` passes; aging/money/date edge cases covered.
- Every manual checklist item passes on installed build.
- Wrap-up report delivered with restore instructions + known limitations.

## Risk Assessment
- **Logic duplicated (not extracted) (MED):** tests test copies, not real code. Mitigate: repos import shared functions (single source).
- **Only dev tested (MED):** Mitigate: checklist explicitly on installed build.
- **Aging off-by-one slips through (LOW):** Mitigate: explicit boundary tests.

## Security Considerations
- Confirm renderer still has no Node/db access (spot-check `window` has only `api`).
- Confirm backups stored in private cloud folder (contain customer PII).

## Next Steps
- v1 done. Backlog (v2): warranty_claims workflow, VAT invoice, code signing, barcode scan, multi-machine. (All YAGNI for v1.)
