# Phase 01 — Suppliers Table, Schema Changes & Migration

## Context Links
- Overview: [plan.md](./plan.md)
- Research (suppliers cols, stock_movements — AR/AP split IGNORED): [./research/researcher-01-supplier-payable.md](./research/researcher-01-supplier-payable.md)
- MODIFIES main schema: [../260613-ebike-shop-crm-mvp/phase-02-database-schema.md](../260613-ebike-shop-crm-mvp/phase-02-database-schema.md)
- Depends on: main v1 Phase 02 (debts, debt_payments, products, inventory_units).

## Overview
- **Date:** 2026-06-13
- **Description:** Add `suppliers` (minimal) + `stock_movements` (minimal ledger) tables; MODIFY main `debts` to be direction-aware (nullable customerId, add direction + nullable supplierId); optional `inventory_units.supplierId`. Generate Drizzle migration. Suppliers CRUD UI.
- **Priority:** High (blocks phase-02 intake).
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- REUSE single `debts` table (user DRY decision) — do NOT add `supplier_debts`. Add a `direction` discriminator + nullable `supplierId` alongside the existing nullable-now `customerId`.
- Main Phase 02 `debts.customerId` is `NOT NULL` + status enum `['open','partial','paid']`. We make customerId nullable and add direction/supplierId. Status enum unchanged (reused for payable).
- `debt_payments` keyed only by `debtId` → already direction-agnostic. CONFIRMED: no change.
- Phase 03 intake records NO movement ledger today. `stock_movements` is genuinely NEW (not duplicating). Justified: needed by flowchart + gives an audit trail for both sale-out (later) and receipt-in; minimal cols only.
- Suppliers minimal per locked decision — NO tax_id / discounts / default_payment_method (all YAGNI; drop research extras).

## Requirements
### Functional
- CRUD suppliers: name (req), phone, address, paymentTermsDays (default 30), note, isActive.
- List suppliers, search by name/phone, toggle active.
- `debts` can represent a payable (direction='payable', supplierId set, customerId null).
- `stock_movements` row writable for an intake (type='in').

### Non-Functional
- Money = INTEGER VND. Dates = TEXT ISO `YYYY-MM-DD`.
- Migration additive + back-compatible: existing receivable debts default `direction='receivable'`.
- Drizzle parameterized; enums validated in repo.

## Architecture (data flow)
```
UI SuppliersPage → window.api.suppliers.{list,create,update,setActive}
  → ipc suppliers:* → suppliersRepo → Drizzle → row
schema.ts (main) EXTENDED: suppliers, stockMovements, debts(modified), inventoryUnits(+supplierId)
```

## Schema changes (Drizzle — EXTENDS main `src/main/db/schema.ts`)
```ts
// NEW — suppliers (minimal)
export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  note: text('note'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

// NEW — stock_movements (minimal ledger)
export const stockMovements = sqliteTable('stock_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  inventoryUnitId: integer('inventory_unit_id').references(() => inventoryUnits.id), // nullable: serialized only
  type: text('type', { enum: ['in', 'out', 'adjust'] }).notNull(),
  qty: integer('qty').notNull(),               // signed: +in / -out
  refType: text('ref_type'),                   // 'supplier_intake' | 'sale' | 'manual'
  refId: integer('ref_id'),                    // intake batchId / saleId
  createdAt: text('created_at').notNull(),
})

// MODIFIED — debts: was customerId NOT NULL. Make nullable + add direction + supplierId.
export const debts = sqliteTable('debts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  direction: text('direction', { enum: ['receivable', 'payable'] }).notNull().default('receivable'), // NEW
  customerId: integer('customer_id').references(() => customers.id),     // CHANGED: nullable
  supplierId: integer('supplier_id').references(() => suppliers.id),     // NEW: nullable
  saleId: integer('sale_id').references(() => sales.id),
  issuedDate: text('issued_date').notNull(),
  dueDate: text('due_date').notNull(),
  amountVnd: integer('amount_vnd').notNull(),
  status: text('status', { enum: ['open', 'partial', 'paid'] }).notNull().default('open'),
  notes: text('notes'),
})
// App-layer invariant: receivable ⇒ customerId set & supplierId null; payable ⇒ supplierId set & customerId null.

// MODIFIED — inventory_units: add provenance (optional, see unresolved Q3)
// + supplierId: integer('supplier_id').references(() => suppliers.id)  // nullable
```

## Migration notes
- If v1 already shipped with old `debts` (customerId NOT NULL): SQLite cannot alter a NOT NULL → nullable in place cleanly. Drizzle emits a table-rebuild (`__new_debts` + copy + drop + rename) — verify generated SQL does this and preserves existing rows with `direction='receivable'`. Backfill: `UPDATE debts SET direction='receivable' WHERE direction IS NULL;` (covered by default).
- PREFERRED: build direction-aware in v1 Phase 02 → this phase only adds `suppliers` + `stock_movements` + `supplierId` cols (pure additive, no rebuild). See plan.md unresolved Q1.
- Run `npm run db:generate` → review new migration file. Confirm: CREATE suppliers, CREATE stock_movements, debts altered, inventory_units +supplier_id.
- FK pragma already ON (Phase 01). Bad FK insert must throw.

## Related Code Files
**Create:**
- `src/main/repos/suppliers.ts` (CRUD + list/search)
- `src/main/ipc/suppliers.ts`
- `src/renderer/src/features/suppliers/SuppliersPage.tsx`
- `.../suppliers/{SupplierFormModal,SupplierTable}.tsx`
- `.../suppliers/useSuppliers.ts`
- `migrations/000X_supplier_payable.sql` (generated)

**Modify (OVERLAP — flag):**
- `src/main/db/schema.ts` — **MODIFIES main Phase 02** (debts change; add suppliers, stockMovements; inventoryUnits +supplierId). Never silently redefine `debts` — apply the diff above.
- `src/shared/types.ts` — add Supplier, StockMovement; widen Debt (direction, supplierId nullable, customerId nullable).
- `src/shared/ipc-contract.ts` — add `suppliers:*` channels.
- `src/main/index.ts` — `registerSuppliersIpc()`.
- `src/preload/index.ts` + `index.d.ts` — expose `api.suppliers`.
- Main Phase 07 `debts.ts` list — will need `direction` filter (done in phase-02 of this plan).

## Implementation Steps
1. Edit `schema.ts`: apply the `debts` diff (nullable customerId, +direction default 'receivable', +supplierId). Add `suppliers` + `stockMovements`. Add `inventoryUnits.supplierId` (if Q3 = yes).
2. `npm run db:generate`. Open generated SQL; verify debts rebuild preserves data + defaults direction. If v1 dev DB only (no prod data), deleting/recreating `app.db` is acceptable per main Phase 02 risk note.
3. Apply migration at startup; inspect `app.db` (DB Browser): suppliers + stock_movements exist; debts has direction/supplier_id cols.
4. `suppliersRepo`: `list()`, `search(q)`, `get(id)`, `create(dto)` (set createdAt + default terms 30), `update(id,dto)`, `setActive(id,bool)`.
5. IPC `suppliers:{list,search,get,create,update,setActive}` mirroring repo.
6. preload namespace `api.suppliers`; types in `index.d.ts` + `shared/types.ts`.
7. UI: `SupplierTable` (name/phone/terms/active badge + edit/toggle), `SupplierFormModal` (`@mantine/form`; name required, paymentTermsDays integer ≥ 0). Search box.
8. Round-trip: create supplier → appears in list → edit terms → toggle inactive.

## Todo List
- [ ] schema.ts: debts diff applied (nullable customerId, +direction, +supplierId)
- [ ] schema.ts: suppliers + stock_movements added
- [ ] schema.ts: inventory_units +supplierId (if Q3 yes)
- [ ] db:generate → migration reviewed (debts rebuild preserves data)
- [ ] migration applies; tables/cols verified in app.db
- [ ] suppliersRepo CRUD + search
- [ ] suppliers IPC + preload + types
- [ ] SuppliersPage + Form + Table + search
- [ ] round-trip create/edit/toggle verified
- [ ] existing receivable debts unaffected (default direction)

## Success Criteria
- `suppliers` + `stock_movements` tables present; `debts` has `direction`,`supplier_id`; `customer_id` nullable.
- Existing receivable debts still load with `direction='receivable'`.
- Create/edit/search/toggle a supplier round-trips via `window.api.suppliers`.
- Inserting a debt with `direction='payable'`, supplierId set, customerId null succeeds; FK enforced.

## Risk Assessment
- **debts NOT NULL→nullable rebuild (MED):** SQLite table-rebuild risk to existing rows. Mitigate: review generated SQL; prefer direction-aware in v1 (additive only). Dev DB has no prod data.
- **Wrong-direction data integrity (MED):** customer debt accidentally gets supplierId. Mitigate: app-layer invariant in repos (assert exactly one of customerId/supplierId per direction).
- **Migration drift (LOW):** regenerate cleanly; document one canonical migration.

## Security Considerations
- Validate `direction`/`status` enums in repo before insert.
- Enforce customerId XOR supplierId by direction in repo (reject malformed).
- Drizzle parameterizes; never string-concat search input.

## Next Steps
- Unblocks phase-02 (goods intake writes inventory + stock_movements + payable debt).
