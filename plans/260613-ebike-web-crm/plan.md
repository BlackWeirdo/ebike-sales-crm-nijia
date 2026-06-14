# E-Bike Shop CRM — WEB Edition Implementation Plan

**Date:** 2026-06-13 | **Status:** In Progress | **Target:** beginner + AI, single-user local web app

## Goal
Web-based CRM for an e-bike shop. Runs in browser at localhost (1 command). Single user, no auth.
4 modules requested + basic sales: **Tồn kho (inventory), Khách hàng (customers), Doanh thu (revenue), Công nợ (debt)**.

## Stack (PIVOTED from Electron → Web)
- **Backend:** Node + TypeScript + Express + better-sqlite3 (raw, prepared statements) + Zod validation. REST API on `/api`.
- **Frontend:** React 18 + Vite + TS + Mantine v7 UI + React Router + TanStack Query + Recharts + dayjs.
- **DB:** SQLite file `data/crm.db`, created via `CREATE TABLE IF NOT EXISTS` on boot (no migration tooling — KISS).
- **Money:** INTEGER VND everywhere; format via `Intl.NumberFormat('vi-VN')`.
- **Dates:** TEXT ISO `YYYY-MM-DD`. Aging computed in SQL/app, never stored.
- **Run:** `npm run dev` (vite + tsx concurrently, vite proxies /api → 3001). `npm run build && npm start` for production (express serves built client).

## Reused from Electron plan
Domain model + schema design (`../260613-ebike-shop-crm-mvp/research/researcher-02-domain-model.md`). Adapted IPC → REST.

## Scope (v1)
IN: products (SERIALIZED bikes + QUANTITY accessories), inventory_units, customers, sales + sale_items, debts + debt_payments, dashboard.
OUT (YAGNI): auth, warranty, maintenance reminders, suppliers, multi-machine, tax/VAT, packaging/installer.

## Phases
| # | Phase | File | Status |
|---|-------|------|--------|
| 01 | Scaffold + backend (schema, repos, REST API) | [phase-01-backend.md](./phase-01-backend.md) | ✅ Done |
| 02 | Frontend shell + 4 modules + dashboard | (built) | ✅ Done |
| 03 | Run, smoke-test (API + UI render) | (verified) | ✅ Done |

## Build notes (actual)
- **DB pivot:** `better-sqlite3` needs native build (no Python/build-tools, Node 24 too new for prebuilds) → switched to built-in **`node:sqlite`** (DatabaseSync) + manual `transaction()` helper. Zero native deps.
- **Verified:** typecheck clean; API end-to-end (sale → stock decrement → debt → payment → dashboard) correct; negative tests (oversell / double-sell serial / overpay) blocked atomically; all 5 pages render in headless Chromium with 0 console errors.

## Key Logic
- **Sale completion (transaction):** insert sale + items, mark serialized units `sold`, decrement QUANTITY stock, if `paid < total` create a `debt` row (amount = total - paid).
- **Doanh thu:** sum `sales.total_vnd` by day/month; SQLite date string filtering.
- **Công nợ:** outstanding = debt.amount - SUM(debt_payments). Aging buckets by due_date vs today.
