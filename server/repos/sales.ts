import { db, transaction } from '../db.ts'
import type { SaleDetail, SaleListItem, CreateSaleInput, PaymentAccountLine } from '@shared/types'
import { debtsRepo } from './debts.ts'
import { customersRepo } from './customers.ts'

// Snapshot tài khoản nhận tiền: lưu nguyên văn JSON do client gửi (chỉ-để-in, không động tới tiền).
function serializePaymentAccounts(input: CreateSaleInput): string {
  return JSON.stringify(input.paymentAccounts ?? [])
}
function parsePaymentAccounts(raw: unknown): PaymentAccountLine[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as PaymentAccountLine[]) : []
  } catch {
    return []
  }
}

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

type ComputedLine = CreateSaleInput['items'][number] & { lineTotal: number }

// Compute per-line totals + subtotal, then validate the order's money. Shared by create + update.
function computeAndValidate(input: CreateSaleInput): { lines: ComputedLine[]; subtotal: number; total: number } {
  let subtotal = 0
  const lines = input.items.map((it) => {
    const lineTotal = it.qty * it.unitPriceVnd - it.lineDiscountVnd
    subtotal += lineTotal
    return { ...it, lineTotal }
  })
  const total = subtotal - input.discountVnd
  if (total < 0) throw new Error('Tổng tiền không hợp lệ (âm)')
  if (input.paidVnd < 0 || input.paidVnd > total) throw new Error('Số tiền thanh toán không hợp lệ')
  return { lines, subtotal, total }
}

// Consume inventory (serial → sold / quantity → decrement) and insert sale_items rows.
function writeItems(saleId: number, lines: ComputedLine[], saleDate: string): void {
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
      db.prepare(`UPDATE inventory_units SET status='sold', sold_on_date=? WHERE id=?`).run(saleDate, line.inventoryUnitId)
      insItem.run(saleId, line.productId, line.inventoryUnitId, 1, line.unitPriceVnd, line.lineDiscountVnd, line.lineTotal)
    } else {
      if (line.qty <= 0) throw new Error('Số lượng phải > 0')
      if (product.qty_on_hand < line.qty) throw new Error('Không đủ tồn kho')
      db.prepare(`UPDATE products SET qty_on_hand = qty_on_hand - ? WHERE id = ?`).run(line.qty, line.productId)
      insItem.run(saleId, line.productId, null, line.qty, line.unitPriceVnd, line.lineDiscountVnd, line.lineTotal)
    }
  }
}

// Reverse the inventory effects of a sale's current items (serial → in_stock, quantity → += qty).
function restoreInventory(saleId: number): void {
  const items = db
    .prepare(`SELECT product_id AS productId, inventory_unit_id AS inventoryUnitId, qty FROM sale_items WHERE sale_id = ?`)
    .all(saleId) as Array<{ productId: number | null; inventoryUnitId: number | null; qty: number }>
  for (const it of items) {
    if (it.inventoryUnitId) {
      db.prepare(`UPDATE inventory_units SET status='in_stock', sold_on_date=NULL WHERE id=?`).run(it.inventoryUnitId)
    } else if (it.productId) {
      db.prepare(`UPDATE products SET qty_on_hand = qty_on_hand + ? WHERE id = ?`).run(it.qty, it.productId)
    }
  }
}

// Drop a sale's debt payments → debts → items (in FK-safe order). Does NOT delete the sale row.
function dropDebtsAndItems(saleId: number): void {
  db.prepare(`DELETE FROM debt_payments WHERE debt_id IN (SELECT id FROM debts WHERE sale_id = ?)`).run(saleId)
  db.prepare(`DELETE FROM debts WHERE sale_id = ?`).run(saleId)
  db.prepare(`DELETE FROM sale_items WHERE sale_id = ?`).run(saleId)
}

// Create a debt for the unpaid balance, if any. Requires a customer.
function createDebtIfUnderpaid(saleId: number, input: CreateSaleInput, total: number): void {
  const balance = total - input.paidVnd
  if (balance <= 0) return
  if (!input.customerId) throw new Error('Bán nợ phải chọn khách hàng')
  const dueDate = input.dueDate ?? addDays(input.saleDate, 30)
  db.prepare(
    `INSERT INTO debts (customer_id, sale_id, issued_date, due_date, amount_vnd, status, notes)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
  ).run(input.customerId, saleId, input.saleDate, dueDate, balance, `Công nợ từ đơn bán #${saleId}`)
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
        `SELECT ${SALE_COLS}, s.payment_accounts AS paymentAccountsJson, c.name AS customerName,
                (s.paid_vnd + ${DEBT_PAID_SUBQUERY}) AS collectedVnd,
                (s.total_vnd - s.paid_vnd - ${DEBT_PAID_SUBQUERY}) AS remainingVnd
         FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?`,
      )
      .get(id) as (SaleDetail & { paymentAccountsJson?: string | null }) | undefined
    if (!sale) return undefined
    sale.paymentAccounts = parsePaymentAccounts(sale.paymentAccountsJson)
    delete sale.paymentAccountsJson
    sale.debt = debtsRepo.getBySale(id)
    sale.customer = sale.customerId ? (customersRepo.get(sale.customerId) ?? null) : null
    sale.items = db
      .prepare(
        `SELECT si.id, si.sale_id AS saleId, si.product_id AS productId,
                si.inventory_unit_id AS inventoryUnitId, si.qty,
                si.unit_price_vnd AS unitPriceVnd, si.line_discount_vnd AS lineDiscountVnd,
                si.line_total_vnd AS lineTotalVnd,
                p.name AS productName, p.sku AS productSku, u.serial_number AS serialNumber
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
      const { lines, subtotal, total } = computeAndValidate(input)
      const saleInfo = db
        .prepare(
          `INSERT INTO sales (customer_id, sale_date, subtotal_vnd, discount_vnd, total_vnd, paid_vnd, payment_method, notes, payment_accounts)
           VALUES (@customerId, @saleDate, @subtotal, @discountVnd, @total, @paidVnd, @paymentMethod, @notes, @paymentAccounts)`,
        )
        .run({
          customerId: input.customerId,
          saleDate: input.saleDate,
          subtotal,
          discountVnd: input.discountVnd,
          total,
          paidVnd: input.paidVnd,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          paymentAccounts: serializePaymentAccounts(input),
        })
      const saleId = Number(saleInfo.lastInsertRowid)
      writeItems(saleId, lines, input.saleDate)
      createDebtIfUnderpaid(saleId, input, total)
      return saleId
    })
    return this.get(saleId)!
  },

  // Atomic edit of an existing sale (e.g. apply a retroactive discount): reverse the old
  // inventory + drop the old debt/payments, then re-apply the new items/totals/debt.
  // NOTE: the per-installment debt payment history is consolidated — the caller passes the
  // already-collected amount as paidVnd so no money is lost, only the dated breakdown.
  update(id: number, input: CreateSaleInput): SaleDetail {
    transaction(() => {
      const exists = db.prepare(`SELECT id FROM sales WHERE id = ?`).get(id)
      if (!exists) throw new Error('Không tìm thấy đơn hàng')
      const { lines, subtotal, total } = computeAndValidate(input)

      // Guard against silently destroying money: dropDebtsAndItems wipes the installment history,
      // so the new paid_vnd MUST cover what was already collected (capped at the new total when a
      // retroactive discount pushes the total below what the customer already paid).
      const collected = (
        db
          .prepare(
            `SELECT s.paid_vnd + COALESCE(
               (SELECT SUM(dp.amount_vnd) FROM debt_payments dp
                JOIN debts d ON d.id = dp.debt_id WHERE d.sale_id = ?), 0) AS v
             FROM sales s WHERE s.id = ?`,
          )
          .get(id, id) as { v: number }
      ).v
      if (input.paidVnd < Math.min(collected, total)) {
        throw new Error('Số tiền "Khách trả" không được nhỏ hơn số tiền đã thu thực tế của đơn')
      }

      restoreInventory(id) // put old stock back BEFORE re-consuming (a kept serial frees up then re-sells)
      dropDebtsAndItems(id)
      db.prepare(
        `UPDATE sales SET customer_id=@customerId, sale_date=@saleDate, subtotal_vnd=@subtotal,
           discount_vnd=@discountVnd, total_vnd=@total, paid_vnd=@paidVnd, payment_method=@paymentMethod,
           notes=@notes, payment_accounts=@paymentAccounts
         WHERE id=@id`,
      ).run({
        id,
        customerId: input.customerId,
        saleDate: input.saleDate,
        subtotal,
        discountVnd: input.discountVnd,
        total,
        paidVnd: input.paidVnd,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        paymentAccounts: serializePaymentAccounts(input),
      })
      writeItems(id, lines, input.saleDate)
      createDebtIfUnderpaid(id, input, total)
    })
    return this.get(id)!
  },

  // Hard-delete a sale and undo its side effects (for fixing mistakes):
  // restore inventory, drop its debt + payments + items, then remove the sale itself.
  // All atomic so a failure leaves nothing half-undone.
  remove(id: number): void {
    const sale = db.prepare(`SELECT id FROM sales WHERE id = ?`).get(id)
    if (!sale) throw new Error('Không tìm thấy đơn hàng')
    transaction(() => {
      restoreInventory(id)
      dropDebtsAndItems(id)
      db.prepare(`DELETE FROM sales WHERE id = ?`).run(id)
    })
  },
}
