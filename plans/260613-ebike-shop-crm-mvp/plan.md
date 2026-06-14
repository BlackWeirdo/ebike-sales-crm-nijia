# E-Bike Shop CRM — MVP Implementation Plan

**Date:** 2026-06-13 | **Status:** Not Started | **Target dev:** beginner + AI

## Goal
Mini desktop CRM for an e-bike shop. Single user, single Windows machine, no auth, offline. 5 modules + dashboard. Serial-tracked bikes, multi-record warranty, maintenance reminders, debt (công nợ) aging. Build by VERTICAL SLICES.

## Stack (LOCKED — do not re-litigate)
Electron (electron-vite) + React + TS + Vite + Mantine UI + better-sqlite3 + Drizzle ORM + Recharts. DB only in main process; renderer → typed IPC (contextBridge, contextIsolation on, nodeIntegration off, sandbox on). Money = INTEGER VND. Print via `printToPDF`/`window.print()`. Auto-backup via `.backup()` to cloud-synced folder.

## Context Files
- Brainstorm: `./reports/00-brainstorm-summary.md`
- Stack research: `./research/260613-electron-stack-research.md`
- Domain model: `./research/researcher-02-domain-model.md`

## Phases
| # | Phase | File | Status | Progress |
|---|-------|------|--------|----------|
| 01 | Project setup & app shell | [phase-01-project-setup.md](./phase-01-project-setup.md) | Not Started | 0% |
| 02 | DB schema & data-access layer | [phase-02-database-schema.md](./phase-02-database-schema.md) | Not Started | 0% |
| 03 | Inventory module | [phase-03-inventory.md](./phase-03-inventory.md) | Not Started | 0% |
| 04 | POS / Sales module | [phase-04-pos-sales.md](./phase-04-pos-sales.md) | Not Started | 0% |
| 05 | Customers module | [phase-05-customers.md](./phase-05-customers.md) | Not Started | 0% |
| 06 | Warranty + maintenance | [phase-06-warranty-maintenance.md](./phase-06-warranty-maintenance.md) | Not Started | 0% |
| 07 | Debt (công nợ) module | [phase-07-debt.md](./phase-07-debt.md) | Not Started | 0% |
| 08 | Dashboard | [phase-08-dashboard.md](./phase-08-dashboard.md) | Not Started | 0% |
| 09 | Packaging & backup hardening | [phase-09-packaging-backup.md](./phase-09-packaging-backup.md) | Not Started | 0% |
| 10 | Manual tests + wrap-up | [phase-10-testing-wrapup.md](./phase-10-testing-wrapup.md) | Not Started | 0% |

## High-Level Timeline (beginner pace, ~6-8 wk)
- Wk 1: Phase 01-02 (shell + schema). Hardest setup — native rebuild pitfall.
- Wk 2-3: Phase 03-04 (first vertical slice: nhập xe → bán → giảm tồn).
- Wk 4: Phase 05-06 (customer history + warranty print).
- Wk 5: Phase 07-08 (debt aging + dashboard).
- Wk 6: Phase 09-10 (installer + test + wrap-up).

## Key Dependencies
- 01 → all (shell + IPC scaffold + DB init required first).
- 02 → 03-08 (schema/repos/IPC handlers underpin every module).
- 03 (products + units exist) → 04 (sale consumes inventory).
- 04 (sale creates) → 05 (history), 06 (auto-warranty on bike sale), 07 (debt from unpaid sale).
- 03-07 (data exists) → 08 (dashboard aggregates).
- 01-08 done → 09 (package) → 10 (test/wrap-up).

## Vertical-Slice Milestone (prove early, end of Phase 04)
Nhập 1 xe (serial) → bán cho 1 khách (partial payment) → unit = sold, stock decremented, sale saved. Validates IPC + schema + 2 modules before widening.

## YAGNI — OUT of scope v1
Auth/roles, multi-machine sync, thermal ESC/POS printer, barcode scanner, ABC analysis, forecasting/targets, vouchers/promotions, online channel, VAT/tax, warranty_claims workflow (defer — see open Qs).

## Unresolved Questions
1. **VAT/tax:** schema has no tax columns (deferred). Confirm v1 sells tax-inclusive prices only. If VAT invoice needed later → schema change.
2. **warranty_claims table:** domain research proposes it, but claim workflow is OUT of v1 scope. Plan stores warranty_records only; claims = v2. Confirm OK.
3. **QR on warranty slip:** include QR (encode serial) or plain text only for v1? Plan defaults to plain text (KISS); QR optional in Phase 06.
4. **Debt due_date source:** auto-set due_date = sale_date + N days (default N?) or manual entry per sale? Plan defaults to manual due_date field at checkout, fallback sale_date+30.
5. **Backup frequency/retention:** daily-once on startup (plan default). Keep last N backups or unlimited? Plan keeps unlimited (small files); revisit if disk concern.
6. **Electron version pin:** research flags Electron 42+ build issues with better-sqlite3. Plan pins Electron 33/34 LTS-stable. Confirm before `npm install`.
7. **suppliers table:** optional in scope. Plan includes minimal `suppliers` + nullable `products.supplier_id` only if nhập-kho needs it; otherwise skip (YAGNI). Default: SKIP for v1.
