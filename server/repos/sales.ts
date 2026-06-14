import { db, transaction } from '../db.ts'
import type { SaleDetail, SaleListItem, CreateSaleInput } from '@shared/types'
import { debtsRepo } from './debts.ts'
import { customersRepo } from './customers.ts'

// Total collected after the sale = paid at checkout + every debt payment linked to this sale.
// debt_payments is the single source of truth for post-sale collections.
const DEBT_PAID_SUBQUERY = `COALESCE((
  SELECT SUM(dp.amount_vnd) FROM debt_payments dp
  JOIN debts d ON d.id = dp.debt_id WHERE d.sale_id = s.id
), 0)`

const SALE_COLS = `
  s.id, s.customer_id AS customerId, s.sale_date AS saleDate,
  s.subtotal_vnd AS subtotalVnd, s.discount_vnd AS discountVnd, s.total_vnd AS totalVnd,
  s.paid_vnd AS paidVnd, s.payment_method AS paymentMethod, s.notes`

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export const salesRepo = {
  list(): SaleListItem[] {
    return db
      .prepare(
        `SELECT ${SALE_COLS}, c.name AS customerName,
                (s.paid_vnd + ${DEBT_PAID_SUBQUERY}) AS collectedVnd,
                (s.total_vnd - s.paid_vnd - ${DEBT_PAID_SUBQUERY}) AS remainingVnd
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
         ORDER BY s.sale_date DESC, s.id DESC`,
      )
      .all() as unknown as SaleListItem[]
  },

  get(id: number): SaleDetail | undefined {
    const sale = db
      .prepare(
        `SELECT ${SALE_COLS}, c.name AS customerName,
                (s.paid_vnd + ${DEBT_PAID_SUBQUERY}) AS collectedVnd,
                (s.total_vnd - s.paid_vnd - ${DEBT_PAID_SUBQUERY}) AS remainingVnd
         FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?`,
      )
      .get(id) as SaleDetail | undefined
    if (!sale) return undefined
    sale.debt = debtsRepo.getBySale(id)
    sale.customer = sale.customerId ? (customersRepo.get(sale.customerId) ?? null) : null
    sale.items = db
      .prepare(
        `SELECT si.id, si.sale_id AS saleId, si.product_id AS productId,
                si.inventory_unit_id AS inventoryUnitId, si.qty,
                si.unit_price_vnd AS unitPriceVnd, si.line_discount_vnd AS lineDiscountVnd,
                si.line_total_vnd AS lineTotalVnd,
                p.name AS productName, u.serial_number AS serialNumber
         FROM sale_items si
         LEFT JOIN products p ON p.id = si.product_id
         LEFT JOIN inventory_units u ON u.id = si.inventory_unit_id
         WHERE si.sale_id = ?`,
      )
      .all(id) as unknown as SaleDetail['items']
    return sale
  },

  // All orders of one customer (newest first), each with full items — for the customer history view.
  listByCustomer(customerId: number): SaleDetail[] {
    const ids = db
      .prepare(`SELECT id FROM sales WHERE customer_id = ? ORDER BY sale_date DESC, id DESC`)
      .all(customerId) as Array<{ id: number }>
    return ids.map((r) => this.get(r.id)).filter((s): s is SaleDetail => s !== undefined)
  },

  // Atomic sale creation: insert sale + items, consume inventory, create debt if underpaid.
  create(input: CreateSaleInput): SaleDetail {
    const saleId = transaction((): number => {
      const data = input
      let subtotal = 0
      const lines = data.items.map((it) => {
        const lineTotal = it.qty * it.unitPriceVnd - it.lineDiscountVnd
        subtotal += lineTotal
        return { ...it, lineTotal }
      })
      const total = subtotal - data.discountVnd
      if (total < 0) throw new Error('Tổng tiền không hợp lệ (âm)')
      if (data.paidVnd < 0 || data.paidVnd > total) throw new Error('Số tiền thanh toán không hợp lệ')

      const saleInfo = db
        .prepare(
          `INSERT INTO sales (customer_id, sale_date, subtotal_vnd, discount_vnd, total_vnd, paid_vnd, payment_method, notes)
           VALUES (@customerId, @saleDate, @subtotal, @discountVnd, @total, @paidVnd, @paymentMethod, @notes)`,
        )
        .run({
          customerId: data.customerId,
          saleDate: data.saleDate,
          subtotal,
          discountVnd: data.discountVnd,
          total,
          paidVnd: data.paidVnd,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        })
      const saleId = Number(saleInfo.lastInsertRowid)

      const insItem = db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, inventory_unit_id, qty, unit_price_vnd, line_discount_vnd, line_total_vnd)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )

      for (const line of lines) {
        const product = db.prepare(`SELECT id, type, qty_on_hand FROM products WHERE id = ?`).get(line.productId) as
          | { id: number; type: string; qty_on_hand: number }
          | undefined
        if (!product) throw new Error(`Sản phẩm #${line.productId} không tồn tại`)

        if (product.type === 'SERIALIZED') {
          if (!line.inventoryUnitId) throw new Error('Xe (serialized) phải chọn 1 đơn vị (serial) cụ thể')
          const unit = db
            .prepare(`SELECT id, status FROM inventory_units WHERE id = ? AND product_id = ?`)
            .get(line.inventoryUnitId, line.productId) as { id: number; status: string } | undefined
          if (!unit) throw new Error('Đơn vị (serial) không tồn tại')
          if (unit.status !== 'in_stock') throw new Error('Đơn vị (serial) đã bán hoặc không sẵn sàng')
          db.prepare(`UPDATE inventory_units SET status='sold', sold_on_date=? WHERE id=?`).run(
            data.saleDate,
            line.inventoryUnitId,
          )
          insItem.run(saleId, line.productId, line.inventoryUnitId, 1, line.unitPriceVnd, line.lineDiscountVnd, line.lineTotal)
        } else {
          if (line.qty <= 0) throw new Error('Số lượng phải > 0')
          if (product.qty_on_hand < line.qty) throw new Error('Không đủ tồn kho')
          db.prepare(`UPDATE products SET qty_on_hand = qty_on_hand - ? WHERE id = ?`).run(line.qty, line.productId)
          insItem.run(saleId, line.productId, null, line.qty, line.unitPriceVnd, line.lineDiscountVnd, line.lineTotal)
        }
      }

      // Underpaid → công nợ
      const balance = total - data.paidVnd
      if (balance > 0) {
        if (!data.customerId) throw new Error('Bán nợ phải chọn khách hàng')
        const dueDate = data.dueDate ?? addDays(data.saleDate, 30)
        db.prepare(
          `INSERT INTO debts (customer_id, sale_id, issued_date, due_date, amount_vnd, status, notes)
           VALUES (?, ?, ?, ?, ?, 'open', ?)`,
        ).run(data.customerId, saleId, data.saleDate, dueDate, balance, `Công nợ từ đơn bán #${saleId}`)
      }
      return saleId
    })

    return this.get(saleId)!
  },
}
