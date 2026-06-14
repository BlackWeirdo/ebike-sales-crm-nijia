# Phase 01 — Scaffold + Backend (schema, repos, REST API)

## Overview
Single npm project. Express API + SQLite. No auth. Status: In Progress.

## Structure
```
package.json, tsconfig.json, vite.config.ts, .gitignore, README.md
server/
  index.ts            ← express bootstrap, serves /api + (prod) static client
  db.ts               ← better-sqlite3 connection + schema init (CREATE TABLE IF NOT EXISTS) + seed pragma
  types.ts            ← shared TS types
  schema.sql          ← table DDL
  routes/products.ts, customers.ts, sales.ts, debts.ts, dashboard.ts
  repos/*.ts          ← prepared-statement CRUD + domain queries
client/  (Phase 02)
data/crm.db           ← runtime (gitignored)
```

## Tables (raw SQLite)
products, inventory_units, customers, sales, sale_items, debts, debt_payments. (See domain model; warranty/maintenance dropped.)

## API surface
- `GET/POST/PUT/DELETE /api/products` (+ `/api/products/:id/units` for serialized)
- `GET/POST/PUT/DELETE /api/customers`
- `GET /api/sales`, `POST /api/sales` (transaction), `GET /api/sales/:id`
- `GET /api/debts`, `POST /api/debts/:id/payments`, `GET /api/debts/aging`
- `GET /api/dashboard/summary?from=&to=`, `GET /api/dashboard/revenue-series`

## Success Criteria
Server boots, DB file created, all endpoints respond, sale POST is atomic (better-sqlite3 transaction).
