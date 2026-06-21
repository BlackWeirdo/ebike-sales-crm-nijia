import { db, transaction } from '../db.ts'
import type {
  Product,
  ProductWithStock,
  InventoryUnit,
  ImportPayload,
  ImportResult,
  ImportError,
} from '@shared/types'

const PRODUCT_COLS = `
  id, sku, name, type, color,
  cost_vnd AS costVnd, selling_price_vnd AS sellingPriceVnd,
  qty_on_hand AS qtyOnHand, low_stock_threshold AS lowStockThreshold,
  active, created_at AS createdAt`

const UNIT_COLS = `
  id, product_id AS productId, serial_number AS serialNumber, status,
  cost_vnd AS costVnd, acquired_date AS acquiredDate, sold_on_date AS soldOnDate`

export interface ProductInput {
  sku: string
  name: string
  type: 'SERIALIZED' | 'QUANTITY'
  color: string | null
  costVnd: number
  sellingPriceVnd: number
  qtyOnHand: number
  lowStockThreshold: number
  active: number
}

export const productsRepo = {
  list(): ProductWithStock[] {
    return db
      .prepare(
        `SELECT ${PRODUCT_COLS},
          CASE WHEN type = 'SERIALIZED'
            THEN (SELECT COUNT(*) FROM inventory_units u WHERE u.product_id = products.id AND u.status = 'in_stock')
            ELSE qty_on_hand
          END AS unitsInStock
         FROM products ORDER BY name COLLATE NOCASE`,
      )
      .all() as unknown as ProductWithStock[]
  },

  get(id: number): Product | undefined {
    return db.prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE id = ?`).get(id) as Product | undefined
  },

  create(input: ProductInput): Product {
    const info = db
      .prepare(
        `INSERT INTO products (sku, name, type, color, cost_vnd, selling_price_vnd, qty_on_hand, low_stock_threshold, active, created_at)
         VALUES (@sku, @name, @type, @color, @costVnd, @sellingPriceVnd, @qtyOnHand, @lowStockThreshold, @active, @createdAt)`,
      )
      .run({ ...input, createdAt: new Date().toISOString().slice(0, 10) })
    return this.get(Number(info.lastInsertRowid))!
  },

  update(id: number, input: ProductInput): Product | undefined {
    db.prepare(
      `UPDATE products SET sku=@sku, name=@name, type=@type, color=@color, cost_vnd=@costVnd,
        selling_price_vnd=@sellingPriceVnd, qty_on_hand=@qtyOnHand,
        low_stock_threshold=@lowStockThreshold, active=@active WHERE id=@id`,
    ).run({ ...input, id })
    return this.get(id)
  },

  // Hard-delete a product. Refuse if it has sales history (protect financial records);
  // otherwise drop its (unsold) serial units first to satisfy the FK, then the product.
  remove(id: number): void {
    const sold = db.prepare(`SELECT 1 FROM sale_items WHERE product_id = ? LIMIT 1`).get(id)
    if (sold) {
      throw new Error('Sản phẩm đã phát sinh đơn bán — không thể xóa. Hãy tắt "Đang kinh doanh" để ẩn thay vì xóa.')
    }
    transaction(() => {
      db.prepare('DELETE FROM inventory_units WHERE product_id = ?').run(id)
      db.prepare('DELETE FROM products WHERE id = ?').run(id)
    })
  },

  // ---- serialized units ----
  listUnits(productId: number): InventoryUnit[] {
    return db
      .prepare(`SELECT ${UNIT_COLS} FROM inventory_units WHERE product_id = ? ORDER BY id DESC`)
      .all(productId) as unknown as InventoryUnit[]
  },

  addUnit(productId: number, serialNumber: string, costVnd: number, acquiredDate: string): InventoryUnit {
    const info = db
      .prepare(
        `INSERT INTO inventory_units (product_id, serial_number, status, cost_vnd, acquired_date)
         VALUES (?, ?, 'in_stock', ?, ?)`,
      )
      .run(productId, serialNumber, costVnd, acquiredDate)
    return db.prepare(`SELECT ${UNIT_COLS} FROM inventory_units WHERE id = ?`).get(info.lastInsertRowid) as unknown as InventoryUnit
  },

  removeUnit(unitId: number): void {
    db.prepare(`DELETE FROM inventory_units WHERE id = ? AND status = 'in_stock'`).run(unitId)
  },

  // units available for sale (in_stock), for the POS picker
  availableUnits(productId: number): InventoryUnit[] {
    return db
      .prepare(`SELECT ${UNIT_COLS} FROM inventory_units WHERE product_id = ? AND status = 'in_stock' ORDER BY id`)
      .all(productId) as unknown as InventoryUnit[]
  },

  lowStock(): ProductWithStock[] {
    return this.list().filter((p) => p.active && p.unitsInStock <= p.lowStockThreshold)
  },

  /**
   * Bulk import from Excel (2 sheets). Validates EVERYTHING first; if any row is invalid,
   * nothing is written (all-or-nothing) and errors are returned so the user can fix the file.
   */
  importBulk(payload: ImportPayload): ImportResult {
    const errors: ImportError[] = []
    const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

    // Existing products by sku (for resolving units to existing serialized products + detecting updates).
    const existing = db.prepare(`SELECT id, sku, type FROM products`).all() as Array<{
      id: number
      sku: string
      type: string
    }>
    const skuType = new Map<string, string>() // sku -> type (existing ∪ file)
    const existingSkus = new Set<string>()
    for (const p of existing) {
      skuType.set(p.sku, p.type)
      existingSkus.add(p.sku)
    }

    // ---- validate products sheet ----
    const fileSkus = new Set<string>()
    payload.products.forEach((p, i) => {
      const row = i + 1
      if (!p.sku?.trim()) errors.push({ sheet: 'SanPham', row, message: 'Thiếu SKU' })
      else if (fileSkus.has(p.sku)) errors.push({ sheet: 'SanPham', row, message: `SKU trùng trong file: ${p.sku}` })
      if (!p.name?.trim()) errors.push({ sheet: 'SanPham', row, message: 'Thiếu tên sản phẩm' })
      if (p.type !== 'SERIALIZED' && p.type !== 'QUANTITY')
        errors.push({ sheet: 'SanPham', row, message: `Loại không hợp lệ: ${p.type}` })
      if (p.costVnd < 0 || p.sellingPriceVnd < 0)
        errors.push({ sheet: 'SanPham', row, message: 'Giá không được âm' })
      if (p.sku?.trim()) {
        fileSkus.add(p.sku)
        skuType.set(p.sku, p.type) // file overrides type for resolution
      }
    })

    // ---- validate serial units sheet ----
    const fileSerials = new Set<string>()
    const existingSerials = new Set(
      (db.prepare(`SELECT serial_number AS s FROM inventory_units`).all() as Array<{ s: string }>).map((r) => r.s),
    )
    payload.units.forEach((u, i) => {
      const row = i + 1
      if (!u.sku?.trim()) errors.push({ sheet: 'SerialXe', row, message: 'Thiếu SKU mẫu xe' })
      else if (!skuType.has(u.sku))
        errors.push({ sheet: 'SerialXe', row, message: `SKU không tồn tại (cả file lẫn hệ thống): ${u.sku}` })
      else if (skuType.get(u.sku) !== 'SERIALIZED')
        errors.push({ sheet: 'SerialXe', row, message: `SKU ${u.sku} không phải loại xe (serial)` })
      if (!u.serialNumber?.trim()) errors.push({ sheet: 'SerialXe', row, message: 'Thiếu số serial' })
      else if (fileSerials.has(u.serialNumber))
        errors.push({ sheet: 'SerialXe', row, message: `Serial trùng trong file: ${u.serialNumber}` })
      else if (existingSerials.has(u.serialNumber))
        errors.push({ sheet: 'SerialXe', row, message: `Serial đã có trong hệ thống: ${u.serialNumber}` })
      if (u.serialNumber?.trim()) fileSerials.add(u.serialNumber)
      if (!isDate(u.acquiredDate)) errors.push({ sheet: 'SerialXe', row, message: 'Ngày nhập sai (cần YYYY-MM-DD)' })
    })

    if (errors.length > 0) {
      return { ok: false, productsCreated: 0, productsUpdated: 0, unitsCreated: 0, errors }
    }

    // ---- all valid → write in one transaction ----
    let productsCreated = 0
    let productsUpdated = 0
    let unitsCreated = 0
    const today = new Date().toISOString().slice(0, 10)

    transaction(() => {
      const insProd = db.prepare(
        `INSERT INTO products (sku, name, type, color, cost_vnd, selling_price_vnd, qty_on_hand, low_stock_threshold, active, created_at)
         VALUES (@sku, @name, @type, @color, @costVnd, @sellingPriceVnd, @qtyOnHand, @lowStockThreshold, 1, @createdAt)`,
      )
      const updProd = db.prepare(
        `UPDATE products SET name=@name, type=@type, color=@color, cost_vnd=@costVnd,
          selling_price_vnd=@sellingPriceVnd, qty_on_hand=@qtyOnHand, low_stock_threshold=@lowStockThreshold
         WHERE sku=@sku`,
      )
      for (const p of payload.products) {
        const base = {
          sku: p.sku,
          name: p.name,
          type: p.type,
          color: p.color,
          costVnd: p.costVnd,
          sellingPriceVnd: p.sellingPriceVnd,
          qtyOnHand: p.type === 'QUANTITY' ? p.qtyOnHand : 0,
          lowStockThreshold: p.lowStockThreshold,
        }
        if (existingSkus.has(p.sku)) {
          updProd.run(base)
          productsUpdated++
        } else {
          insProd.run({ ...base, createdAt: today })
          productsCreated++
        }
      }

      // resolve sku -> product id (after upsert all products exist)
      const idBySku = new Map<string, number>()
      for (const r of db.prepare(`SELECT id, sku FROM products`).all() as Array<{ id: number; sku: string }>) {
        idBySku.set(r.sku, r.id)
      }
      const insUnit = db.prepare(
        `INSERT INTO inventory_units (product_id, serial_number, status, cost_vnd, acquired_date)
         VALUES (?, ?, 'in_stock', ?, ?)`,
      )
      for (const u of payload.units) {
        insUnit.run(idBySku.get(u.sku)!, u.serialNumber, u.costVnd, u.acquiredDate)
        unitsCreated++
      }
    })

    return { ok: true, productsCreated, productsUpdated, unitsCreated, errors: [] }
  },
}
