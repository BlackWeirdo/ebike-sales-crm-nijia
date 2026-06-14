# Phase 02 — Database Schema & Data-Access Layer

## Context Links
- Overview: [plan.md](./plan.md)
- Domain model: [../research/researcher-02-domain-model.md](./research/researcher-02-domain-model.md)
- Stack research (Drizzle/migrations): [../research/260613-electron-stack-research.md](./research/260613-electron-stack-research.md)
- Depends on: [phase-01-project-setup.md](./phase-01-project-setup.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Define full Drizzle schema for all tables, generate first migration, build repository modules + typed IPC handlers per table. This is the data backbone for Phases 03-08.
- **Priority:** Critical (blocks all module phases)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Money = INTEGER VND everywhere (`integer` cols, never float/real).
- Two product modes: `SERIALIZED` (bikes → 1 `inventory_units` row each) vs `QUANTITY` (accessories → `qty_on_hand` on product). KISS: keep stock qty ON `products` for QUANTITY type instead of separate table.
- Warranty = multi-record per unit (frame/battery rows, separate end dates). Store `start_date` + `months`; compute `end_date` in app/SQL — keeps custom terms flexible.
- Debt aging = COMPUTED from due_date, never stored buckets.
- Dates stored as TEXT ISO `YYYY-MM-DD` (SQLite has no date type; simplest for a beginner + dayjs). All date math via dayjs in app or `julianday()`/string compare in SQL.
- `sale_items` is dual-mode: either `inventory_unit_id` (serialized, qty=1) OR `product_id`+`qty` (stock). Enforce in app logic.
- suppliers table = SKIP v1 (YAGNI) unless nhập-kho needs it. Default omitted.

## Requirements
### Functional
- All tables created via migration at startup.
- Each table has a repository module (CRUD + a few domain queries) callable from renderer via typed IPC.
- Referential integrity via FK (pragma already ON).

### Non-Functional
- Single source of truth for IPC types in `src/shared/`.
- Repos return plain JSON-serializable objects (IPC requirement).
- No SQL injection surface (Drizzle parameterizes; never string-concat user input).

## Architecture
```
src/main/db/schema.ts        ← Drizzle table defs (this phase)
src/main/repos/*.ts          ← per-table CRUD + domain queries
src/main/ipc/<module>.ts     ← ipcMain.handle wrappers → repos
src/shared/ipc-contract.ts   ← channels + arg/return types
src/preload/index.ts         ← window.api.<module>.<fn>
src/renderer/.../api.ts      ← thin typed client (re-export window.api)
```
Data flow per call: UI → `window.api.products.create(dto)` → invoke → handler → `productsRepo.create(dto)` → Drizzle insert → returns row.

## Proposed Schema (Drizzle, `src/main/db/schema.ts`)
```ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

// PRODUCTS — bikes (SERIALIZED) + accessories (QUANTITY)
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  type: text('type', { enum: ['SERIALIZED', 'QUANTITY'] }).notNull(),
  costVnd: integer('cost_vnd').notNull().default(0),
  sellingPriceVnd: integer('selling_price_vnd').notNull().default(0),
  qtyOnHand: integer('qty_on_hand').notNull().default(0),     // QUANTITY only
  lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
  warrantyFrameMonths: integer('warranty_frame_months').notNull().default(0),
  warrantyBatteryMonths: integer('warranty_battery_months').notNull().default(0),
  serviceIntervalMonths: integer('service_interval_months').notNull().default(0), // maintenance reminder
  imagePath: text('image_path'),                              // relative to userData
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

// INVENTORY_UNITS — one per physical serialized bike
export const inventoryUnits = sqliteTable('inventory_units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  serialNumber: text('serial_number').notNull().unique(),
  status: text('status', { enum: ['in_stock', 'sold', 'reserved', 'returned'] }).notNull().default('in_stock'),
  costVnd: integer('cost_vnd').notNull().default(0),
  acquiredDate: text('acquired_date').notNull(),
  soldOnDate: text('sold_on_date'),
})

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
})

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').references(() => customers.id), // nullable: walk-in
  saleDate: text('sale_date').notNull(),
  subtotalVnd: integer('subtotal_vnd').notNull().default(0),
  discountVnd: integer('discount_vnd').notNull().default(0),
  totalVnd: integer('total_vnd').notNull().default(0),
  paidVnd: integer('paid_vnd').notNull().default(0),     // deposit / partial
  paymentMethod: text('payment_method', { enum: ['cash', 'transfer', 'mixed'] }).notNull().default('cash'),
  notes: text('notes'),
})

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id').notNull().references(() => sales.id),
  productId: integer('product_id').references(() => products.id),         // set for both modes (for name/report)
  inventoryUnitId: integer('inventory_unit_id').references(() => inventoryUnits.id), // serialized only
  qty: integer('qty').notNull().default(1),
  unitPriceVnd: integer('unit_price_vnd').notNull(),
  lineDiscountVnd: integer('line_discount_vnd').notNull().default(0),
  lineTotalVnd: integer('line_total_vnd').notNull(),     // qty*unitPrice - lineDiscount
})

export const warrantyRecords = sqliteTable('warranty_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  inventoryUnitId: integer('inventory_unit_id').notNull().references(() => inventoryUnits.id),
  saleId: integer('sale_id').references(() => sales.id),
  customerId: integer('customer_id').references(() => customers.id),
  componentType: text('component_type', { enum: ['frame', 'battery', 'drivetrain', 'other'] }).notNull(),
  startDate: text('start_date').notNull(),
  months: integer('months').notNull(),                  // end = start + months (computed)
  notes: text('notes'),
})

export const maintenanceReminders = sqliteTable('maintenance_reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  inventoryUnitId: integer('inventory_unit_id').notNull().references(() => inventoryUnits.id),
  customerId: integer('customer_id').references(() => customers.id),
  nextServiceDate: text('next_service_date').notNull(),
  status: text('status', { enum: ['pending', 'done', 'skipped'] }).notNull().default('pending'),
  notes: text('notes'),
})

export const debts = sqliteTable('debts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  saleId: integer('sale_id').references(() => sales.id),
  issuedDate: text('issued_date').notNull(),
  dueDate: text('due_date').notNull(),
  amountVnd: integer('amount_vnd').notNull(),           // original owed (= total - paid at sale)
  status: text('status', { enum: ['open', 'partial', 'paid'] }).notNull().default('open'),
  notes: text('notes'),
})

export const debtPayments = sqliteTable('debt_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  debtId: integer('debt_id').notNull().references(() => debts.id),
  paymentDate: text('payment_date').notNull(),
  amountVnd: integer('amount_vnd').notNull(),
  method: text('method', { enum: ['cash', 'transfer'] }).notNull().default('cash'),
  notes: text('notes'),
})
```
**Decision notes:** warranty `end_date` NOT stored (computed `dayjs(startDate).add(months,'month')`). debt outstanding NOT stored (`amountVnd - SUM(payments)`). aging NOT stored. NO warranty_claims (v2). NO suppliers (YAGNI v1).

## Repository Pattern (example `src/main/repos/products.ts`)
```ts
import { db } from '../db/connection'
import { products } from '../db/schema'
import { eq } from 'drizzle-orm'
export const productsRepo = {
  list: () => db.select().from(products).all(),
  get: (id: number) => db.select().from(products).where(eq(products.id, id)).get(),
  create: (dto) => db.insert(products).values({ ...dto, createdAt: new Date().toISOString() }).run(),
  update: (id, dto) => db.update(products).set(dto).where(eq(products.id, id)).run(),
}
```

## IPC Wiring Pattern
```ts
// src/main/ipc/products.ts
import { ipcMain } from 'electron'; import { productsRepo } from '../repos/products'
export function registerProductsIpc() {
  ipcMain.handle('products:list', () => productsRepo.list())
  ipcMain.handle('products:create', (_e, dto) => productsRepo.create(dto))
  // ...
}
// preload: api.products = { list: () => invoke('products:list'), create: d => invoke('products:create', d) }
```

## Related Code Files
**Create:**
- `src/main/db/schema.ts` (above)
- `src/main/repos/{products,inventoryUnits,customers,sales,warranty,maintenance,debts}.ts`
- `src/main/ipc/{products,inventory,customers,sales,warranty,maintenance,debts}.ts`
- `src/shared/types.ts` (DTOs + row types shared with renderer)
- `src/shared/ipc-contract.ts` (extend with all channels)
- `migrations/0000_init.sql` (generated by `npm run db:generate`)
- `src/renderer/src/api.ts` (typed re-export of `window.api`)
**Modify:**
- `src/main/index.ts` (call all `register*Ipc()`)
- `src/preload/index.ts` (expose all module APIs)
- `src/preload/index.d.ts`

## Implementation Steps
1. Write `schema.ts` exactly as above. Keep `drizzle.config.ts` pointing at it (`dialect: 'sqlite'`, `out: './migrations'`).
2. `npm run db:generate` → produces `migrations/0000_init.sql`. Verify it CREATE TABLEs all 9 tables.
3. Confirm Phase-01 startup migrate runs it → tables exist in `app.db` (inspect with DB Browser for SQLite).
4. Build repos one table at a time. Always set date/createdAt in repo, not renderer.
5. Build IPC handlers mirroring repos. Use stable channel naming `<table>:<action>`.
6. Extend preload `window.api` with one namespace per module; add types in `index.d.ts` + `src/shared/types.ts`.
7. Renderer `api.ts` just re-exports `window.api` typed — single import point for UI.
8. Sanity test each module: from a temp dev button, create + list a `customers` row round-trips.

## Todo List
- [ ] schema.ts all 9 tables, money = integer
- [ ] db:generate → 0000_init.sql reviewed
- [ ] migrations apply at startup, tables verified
- [ ] repos per table (CRUD + needed queries)
- [ ] IPC handlers per table, registered in main
- [ ] preload exposes all namespaces, typed
- [ ] shared/types.ts DTOs
- [ ] round-trip create+list verified for ≥1 table

## Success Criteria
- All 9 tables present in `app.db`.
- Renderer can CRUD `customers` and `products` via `window.api` with full TS types.
- No floats in any money column. FK constraints enforced (bad FK insert throws).

## Risk Assessment
- **Migration drift (MED):** schema edits after first generate. Mitigate: regenerate, for v1 dev can delete dev `app.db` and re-init (no prod data yet). Document this.
- **Non-serializable IPC return (LOW):** returning Date objects/class instances. Mitigate: repos return plain rows (TEXT dates), numbers.
- **Dual-mode sale_items confusion (MED):** enforce "unit XOR product+qty" — handled in Phase 04 logic, schema allows both nullable.

## Security Considerations
- Drizzle parameterizes — never build SQL with template strings from user input.
- Validate `type`/`status` enums in repos before insert.
- Single-user: no row-level auth needed.

## Next Steps
- Unblocks Phase 03 (Inventory UI on products/inventory_units) and all later modules.
