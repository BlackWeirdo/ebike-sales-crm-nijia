import { db } from '../db.ts'
import type { Customer, CustomerType } from '@shared/types'

const COLS = `id, type, name, contact_person AS contactPerson, tax_code AS taxCode,
  phone, email, address, notes, created_at AS createdAt`

export interface CustomerInput {
  type: CustomerType
  name: string
  contactPerson: string | null
  taxCode: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

export const customersRepo = {
  list(search?: string, type?: CustomerType): Customer[] {
    const where: string[] = []
    const params: string[] = []
    if (type) {
      where.push('type = ?')
      params.push(type)
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      where.push('(name LIKE ? OR phone LIKE ? OR tax_code LIKE ? OR contact_person LIKE ?)')
      params.push(q, q, q, q)
    }
    const sql = `SELECT ${COLS} FROM customers ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name COLLATE NOCASE`
    return db.prepare(sql).all(...params) as unknown as Customer[]
  },

  get(id: number): Customer | undefined {
    return db.prepare(`SELECT ${COLS} FROM customers WHERE id = ?`).get(id) as Customer | undefined
  },

  create(input: CustomerInput): Customer {
    const info = db
      .prepare(
        `INSERT INTO customers (type, name, contact_person, tax_code, phone, email, address, notes, created_at)
         VALUES (@type, @name, @contactPerson, @taxCode, @phone, @email, @address, @notes, @createdAt)`,
      )
      .run({ ...input, createdAt: new Date().toISOString().slice(0, 10) })
    return this.get(Number(info.lastInsertRowid))!
  },

  update(id: number, input: CustomerInput): Customer | undefined {
    db.prepare(
      `UPDATE customers SET type=@type, name=@name, contact_person=@contactPerson, tax_code=@taxCode,
        phone=@phone, email=@email, address=@address, notes=@notes WHERE id=@id`,
    ).run({ ...input, id })
    return this.get(id)
  },

  remove(id: number): void {
    db.prepare('DELETE FROM customers WHERE id = ?').run(id)
  },

  // Purchase + debt summary used in the customer detail view.
  stats(id: number) {
    const purchases = db
      .prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(total_vnd),0) AS total FROM sales WHERE customer_id = ?`)
      .get(id) as { cnt: number; total: number }
    const outstanding = db
      .prepare(
        `SELECT COALESCE(SUM(d.amount_vnd),0) - COALESCE((
            SELECT SUM(p.amount_vnd) FROM debt_payments p
            JOIN debts d2 ON d2.id = p.debt_id WHERE d2.customer_id = ?), 0) AS bal
         FROM debts d WHERE d.customer_id = ?`,
      )
      .get(id, id) as { bal: number }
    return {
      purchaseCount: purchases.cnt,
      totalSpentVnd: purchases.total,
      outstandingDebtVnd: outstanding.bal,
    }
  },
}
