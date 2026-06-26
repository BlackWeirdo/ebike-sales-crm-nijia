import { db, transaction } from '../db.ts'
import { today } from '../lib/date.ts'
import type { DebtWithBalance, DebtPayment, SaleDebtInfo, PaymentInput } from '@shared/types'

// Recompute debt.status from the sum of its payments. Single source of truth = debt_payments.
function recalcStatus(debtId: number): void {
  const debt = db.prepare(`SELECT amount_vnd AS amount FROM debts WHERE id = ?`).get(debtId) as
    | { amount: number }
    | undefined
  if (!debt) return
  const paid = (
    db.prepare(`SELECT COALESCE(SUM(amount_vnd), 0) AS p FROM debt_payments WHERE debt_id = ?`).get(debtId) as {
      p: number
    }
  ).p
  const status = paid <= 0 ? 'open' : paid >= debt.amount ? 'paid' : 'partial'
  db.prepare(`UPDATE debts SET status = ? WHERE id = ?`).run(status, debtId)
}

function agingBucket(dueDate: string, today: string): { bucket: DebtWithBalance['agingBucket']; days: number } {
  const due = new Date(dueDate + 'T00:00:00').getTime()
  const now = new Date(today + 'T00:00:00').getTime()
  const days = Math.floor((now - due) / 86_400_000)
  if (days <= 0) return { bucket: 'current', days: 0 }
  if (days <= 30) return { bucket: '1-30', days }
  if (days <= 60) return { bucket: '31-60', days }
  if (days <= 90) return { bucket: '61-90', days }
  return { bucket: '90+', days }
}

const DEBT_SELECT = `
  SELECT d.id, d.customer_id AS customerId, d.sale_id AS saleId,
         d.issued_date AS issuedDate, d.due_date AS dueDate,
         d.amount_vnd AS amountVnd, d.status, d.notes,
         c.name AS customerName,
         COALESCE((SELECT SUM(p.amount_vnd) FROM debt_payments p WHERE p.debt_id = d.id), 0) AS paidVnd
  FROM debts d JOIN customers c ON c.id = d.customer_id`

type RawDebt = Omit<DebtWithBalance, 'balanceVnd' | 'agingBucket' | 'daysOverdue'>

function decorate(rows: RawDebt[]): DebtWithBalance[] {
  const todayStr = today()
  return rows.map((r) => {
    const balanceVnd = r.amountVnd - r.paidVnd
    const { bucket, days } = agingBucket(r.dueDate, todayStr)
    return {
      ...r,
      balanceVnd,
      agingBucket: balanceVnd > 0 ? bucket : 'current',
      daysOverdue: balanceVnd > 0 ? days : 0,
    }
  })
}

export const debtsRepo = {
  // status filter: 'all' | 'open' (unpaid balance) | 'paid'
  list(filter: 'all' | 'open' | 'paid' = 'all'): DebtWithBalance[] {
    const rows = db.prepare(`${DEBT_SELECT} ORDER BY d.due_date ASC`).all() as RawDebt[]
    const all = decorate(rows)
    if (filter === 'open') return all.filter((d) => d.balanceVnd > 0)
    if (filter === 'paid') return all.filter((d) => d.balanceVnd <= 0)
    return all
  },

  get(id: number): DebtWithBalance | undefined {
    const row = db.prepare(`${DEBT_SELECT} WHERE d.id = ?`).get(id) as RawDebt | undefined
    return row ? decorate([row])[0] : undefined
  },

  payments(debtId: number): DebtPayment[] {
    return db
      .prepare(
        `SELECT id, debt_id AS debtId, payment_date AS paymentDate, paid_at AS paidAt,
                amount_vnd AS amountVnd, method, notes
         FROM debt_payments WHERE debt_id = ? ORDER BY payment_date, id`,
      )
      .all(debtId) as unknown as DebtPayment[]
  },

  // Debt linked to a sale (at most one in our model), with its payments. Used by Sales detail view.
  getBySale(saleId: number): SaleDebtInfo | null {
    const debt = db
      .prepare(
        `SELECT id, due_date AS dueDate, amount_vnd AS amountVnd, status FROM debts WHERE sale_id = ? LIMIT 1`,
      )
      .get(saleId) as { id: number; dueDate: string; amountVnd: number; status: SaleDebtInfo['status'] } | undefined
    if (!debt) return null
    const paidVnd = (
      db.prepare(`SELECT COALESCE(SUM(amount_vnd), 0) AS p FROM debt_payments WHERE debt_id = ?`).get(debt.id) as {
        p: number
      }
    ).p
    return {
      id: debt.id,
      amountVnd: debt.amountVnd,
      paidVnd,
      balanceVnd: debt.amountVnd - paidVnd,
      status: debt.status,
      dueDate: debt.dueDate,
      payments: this.payments(debt.id),
    }
  },

  addPayment(debtId: number, input: PaymentInput): DebtWithBalance {
    transaction(() => {
      const debt = this.get(debtId)
      if (!debt) throw new Error('Không tìm thấy công nợ')
      if (input.amountVnd <= 0) throw new Error('Số tiền thanh toán phải > 0')
      if (input.amountVnd > debt.balanceVnd) throw new Error('Số tiền vượt quá dư nợ còn lại')
      db.prepare(
        `INSERT INTO debt_payments (debt_id, payment_date, paid_at, amount_vnd, method, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(debtId, input.paidAt.slice(0, 10), input.paidAt, input.amountVnd, input.method, input.notes)
      recalcStatus(debtId)
    })
    return this.get(debtId)!
  },

  updatePayment(paymentId: number, input: PaymentInput): DebtWithBalance {
    let debtId = 0
    transaction(() => {
      const pay = db.prepare(`SELECT debt_id AS debtId, amount_vnd AS amountVnd FROM debt_payments WHERE id = ?`).get(
        paymentId,
      ) as { debtId: number; amountVnd: number } | undefined
      if (!pay) throw new Error('Không tìm thấy lần thanh toán')
      debtId = pay.debtId
      const debt = this.get(debtId)!
      if (input.amountVnd <= 0) throw new Error('Số tiền thanh toán phải > 0')
      // max allowed = original debt amount minus all OTHER payments
      const maxAllowed = debt.amountVnd - (debt.paidVnd - pay.amountVnd)
      if (input.amountVnd > maxAllowed) throw new Error('Số tiền vượt quá dư nợ còn lại')
      db.prepare(
        `UPDATE debt_payments SET payment_date = ?, paid_at = ?, amount_vnd = ?, method = ?, notes = ? WHERE id = ?`,
      ).run(input.paidAt.slice(0, 10), input.paidAt, input.amountVnd, input.method, input.notes, paymentId)
      recalcStatus(debtId)
    })
    return this.get(debtId)!
  },

  deletePayment(paymentId: number): DebtWithBalance | undefined {
    let debtId = 0
    transaction(() => {
      const pay = db.prepare(`SELECT debt_id AS debtId FROM debt_payments WHERE id = ?`).get(paymentId) as
        | { debtId: number }
        | undefined
      if (!pay) throw new Error('Không tìm thấy lần thanh toán')
      debtId = pay.debtId
      db.prepare(`DELETE FROM debt_payments WHERE id = ?`).run(paymentId)
      recalcStatus(debtId)
    })
    return this.get(debtId)
  },

  // Aging report: totals per bucket over debts with outstanding balance.
  aging() {
    const open = this.list('open')
    const buckets: Record<DebtWithBalance['agingBucket'], { count: number; totalVnd: number }> = {
      current: { count: 0, totalVnd: 0 },
      '1-30': { count: 0, totalVnd: 0 },
      '31-60': { count: 0, totalVnd: 0 },
      '61-90': { count: 0, totalVnd: 0 },
      '90+': { count: 0, totalVnd: 0 },
    }
    for (const d of open) {
      buckets[d.agingBucket].count += 1
      buckets[d.agingBucket].totalVnd += d.balanceVnd
    }
    const totalOutstandingVnd = open.reduce((s, d) => s + d.balanceVnd, 0)
    return { buckets, totalOutstandingVnd, openCount: open.length }
  },
}
