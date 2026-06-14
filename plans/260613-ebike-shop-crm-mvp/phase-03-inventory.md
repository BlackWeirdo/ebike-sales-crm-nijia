# Phase 03 — Inventory Module

## Context Links
- Overview: [plan.md](./plan.md)
- Domain model (serialized vs stock): [../research/researcher-02-domain-model.md](./research/researcher-02-domain-model.md)
- Depends on: [phase-02-database-schema.md](./phase-02-database-schema.md)

## Overview
- **Date:** 2026-06-13
- **Description:** First half of the core vertical slice. UI to manage products (bikes SERIALIZED vs accessories QUANTITY), nhập/xuất kho (intake/adjust), per-unit serial tracking, product image upload to userData, low-stock threshold flag.
- **Priority:** High (slice start; feeds POS)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Two flows diverge by `product.type`:
  - SERIALIZED (bike): nhập kho = add `inventory_units` rows (one serial each). Stock = COUNT(units where status='in_stock').
  - QUANTITY (accessory): nhập kho = increment `products.qty_on_hand`. No units.
- Low stock: SERIALIZED → in_stock count ≤ threshold; QUANTITY → qty_on_hand ≤ threshold.
- Images: copy file into `userData/images/<id>-<filename>`; store RELATIVE path. Renderer loads via a `media:get` IPC returning data URL OR a custom protocol. KISS v1: IPC returns base64 data URL on demand.

## Requirements
### Functional
- List products with type, price, current stock, low-stock badge.
- Create/edit product (sku, name, type, prices, warranty months, service interval, low-stock threshold, image).
- For SERIALIZED: add intake = enter N serials → N units created in_stock. View/list units per product with status.
- For QUANTITY: intake (+qty) and manual adjust (±qty with reason note).
- Upload product image; show thumbnail.
- Filter/search by name/sku; filter low-stock only.

### Non-Functional
- Serial uniqueness enforced (DB unique + friendly error).
- All money integer VND; format with `vi-VN` grouping for display.

## Architecture
- UI: `InventoryPage` → `ProductTable` (Mantine `Table`/DataTable) + `ProductFormModal` + `IntakeModal` + `UnitListDrawer`.
- IPC: `products:*`, `inventory:listUnits`, `inventory:intakeSerialized`, `inventory:adjustQuantity`, `media:save`, `media:get`.
- Stock computed in repo query (LEFT JOIN count for serialized).

## Data Flow (intake serialized)
UI submits serials[] → `window.api.inventory.intakeSerialized({productId, serials, costVnd, acquiredDate})` → main: for each serial insert unit (txn) → return created count. Errors (dup serial) bubble as friendly message.

## Related Code Files
**Create:**
- `src/renderer/src/features/inventory/InventoryPage.tsx`
- `.../inventory/ProductFormModal.tsx`, `IntakeModal.tsx`, `UnitListDrawer.tsx`
- `.../inventory/useInventory.ts` (data hooks calling api)
- `src/main/repos/inventory.ts` (intake, adjust, stock counts) — extend
- `src/main/ipc/media.ts` (save/get image)
- `src/main/media.ts` (copy file to userData/images, read as data URL)
- `src/shared/types.ts` (Product, InventoryUnit, IntakeDto) — extend
**Modify:**
- `src/main/index.ts` (register media ipc), `src/preload/index.ts` (+namespaces)

## Implementation Steps
1. Repo: `productsWithStock()` → join: serialized count of in_stock units; quantity → qty_on_hand. Return unified `stock` number + `lowStock` boolean.
2. Repo `intakeSerialized(productId, serials[], costVnd, acquiredDate)`: wrap in `getSqlite().transaction(() => {...})` — insert each unit; on dup serial throw `Serial "X" đã tồn tại`.
3. Repo `adjustQuantity(productId, delta, note)`: guard `qtyOnHand + delta >= 0`; update.
4. Media: `saveImage(srcPath)` → mkdir `userData/images`, copy, return relative path. `getImage(relPath)` → read, return `data:image/...;base64,...`. Wire IPC.
5. UI `ProductFormModal`: Mantine `form` (`@mantine/form`) with validation (sku required, prices ≥ 0 integer). Type select drives which warranty/service fields show. File input → call `media.save`, store returned path.
6. UI `IntakeModal`: if SERIALIZED → textarea or repeatable input for serials + acquiredDate + per-unit cost; if QUANTITY → number qty + note.
7. `ProductTable`: columns name/sku/type/price/stock + low-stock `Badge` (red if `lowStock`). Row actions: edit, intake, view units (serialized).
8. `UnitListDrawer`: list units of a product with serial + status badge.
9. Format VND helper `formatVnd(n) => n.toLocaleString('vi-VN') + ' ₫'` in `src/renderer/src/lib/format.ts` (reuse everywhere).

## Todo List
- [ ] productsWithStock query (dual-mode stock + lowStock)
- [ ] intakeSerialized (txn, dup-serial error)
- [ ] adjustQuantity (+/-, no negative)
- [ ] media save/get image (userData/images)
- [ ] ProductFormModal (type-driven fields, validation)
- [ ] IntakeModal (serialized vs qty branches)
- [ ] ProductTable + low-stock badge + search/filter
- [ ] UnitListDrawer per product
- [ ] formatVnd helper

## Success Criteria
- Create a bike (SERIALIZED), intake 3 serials → stock shows 3, 3 units in_stock.
- Create accessory (QUANTITY), intake +10 → stock 10; adjust -3 → 7.
- Duplicate serial intake shows friendly error, no partial insert.
- Low-stock badge appears when stock ≤ threshold.
- Product image uploads + thumbnail renders.

## Risk Assessment
- **Partial intake on dup serial (MED):** Mitigate: single transaction (all-or-nothing).
- **Image path breaks after app move (LOW):** store relative to userData, resolve at read. OK.
- **Large image base64 over IPC (LOW):** thumbnails small; acceptable v1. If slow → custom `app://` protocol later.

## Security Considerations
- Validate file type/extension on image save (allow jpg/png/webp only).
- No path traversal: derive filename from basename, never use client-supplied absolute paths for read.

## Next Steps
- Feeds Phase 04 (POS consumes in_stock units / qty). Vertical slice continues there.
