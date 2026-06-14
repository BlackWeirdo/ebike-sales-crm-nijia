import { db } from '../db.ts'
import type {
  DashboardSummary,
  RevenuePoint,
  CustomerAnalytics,
  ProductAnalytics,
  CustomerType,
  ProductType,
} from '@shared/types'
import { productsRepo } from './products.ts'

export const dashboardRepo = {
  summary(from: string, to: string): DashboardSummary {
    const rev = db
      .prepare(
        `SELECT COALESCE(SUM(total_vnd),0) AS revenue, COALESCE(SUM(paid_vnd),0) AS paidAtSale, COUNT(*) AS cnt
         FROM sales WHERE sale_date BETWEEN ? AND ?`,
      )
      .get(from, to) as { revenue: number; paidAtSale: number; cnt: number }

    const debtPay = db
      .prepare(`SELECT COALESCE(SUM(amount_vnd),0) AS v FROM debt_payments WHERE payment_date BETWEEN ? AND ?`)
      .get(from, to) as { v: number }

    const newCust = db
      .prepare(`SELECT COUNT(*) AS c FROM customers WHERE created_at BETWEEN ? AND ?`)
      .get(from, to) as { c: number }

    const outstanding = db
      .prepare(
        `SELECT COALESCE(SUM(amount_vnd),0) - COALESCE((SELECT SUM(amount_vnd) FROM debt_payments),0) AS bal FROM debts`,
      )
      .get() as { bal: number }

    const topProducts = db
      .prepare(
        `SELECT p.name AS name, SUM(si.qty) AS qty, SUM(si.line_total_vnd) AS revenueVnd
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         WHERE s.sale_date BETWEEN ? AND ?
         GROUP BY si.product_id ORDER BY revenueVnd DESC LIMIT 5`,
      )
      .all(from, to) as { name: string; qty: number; revenueVnd: number }[]

    return {
      from,
      to,
      revenueVnd: rev.revenue,
      collectedVnd: rev.paidAtSale + debtPay.v,
      salesCount: rev.cnt,
      newCustomers: newCust.c,
      outstandingDebtVnd: outstanding.bal,
      lowStockCount: productsRepo.lowStock().length,
      topProducts,
    }
  },

  revenueSeries(from: string, to: string): RevenuePoint[] {
    return db
      .prepare(
        `SELECT sale_date AS date, SUM(total_vnd) AS revenueVnd
         FROM sales WHERE sale_date BETWEEN ? AND ?
         GROUP BY sale_date ORDER BY sale_date`,
      )
      .all(from, to) as unknown as RevenuePoint[]
  },

  customerAnalytics(from: string, to: string): CustomerAnalytics {
    // Doanh thu mỗi đơn quy về loại khách của đơn đó. Khách trống (khách lẻ) bỏ qua phần doanh thu theo loại.
    const byTypeRows = db
      .prepare(
        `SELECT c.type AS type, COUNT(DISTINCT c.id) AS count,
                COALESCE(SUM(s.total_vnd), 0) AS revenueVnd
         FROM customers c
         LEFT JOIN sales s ON s.customer_id = c.id AND s.sale_date BETWEEN ? AND ?
         GROUP BY c.type`,
      )
      .all(from, to) as { type: CustomerType; count: number; revenueVnd: number }[]
    // Đảm bảo luôn có cả 2 loại để biểu đồ ổn định.
    const byType = (['individual', 'dealer'] as CustomerType[]).map(
      (t) => byTypeRows.find((r) => r.type === t) ?? { type: t, count: 0, revenueVnd: 0 },
    )

    const topCustomers = db
      .prepare(
        `SELECT c.id AS id, c.name AS name, c.type AS type,
                COALESCE(SUM(s.total_vnd), 0) AS revenueVnd, COUNT(s.id) AS orders
         FROM customers c
         JOIN sales s ON s.customer_id = c.id AND s.sale_date BETWEEN ? AND ?
         GROUP BY c.id HAVING revenueVnd > 0
         ORDER BY revenueVnd DESC LIMIT 8`,
      )
      .all(from, to) as { id: number; name: string; type: CustomerType; revenueVnd: number; orders: number }[]

    const newCustomersSeries = db
      .prepare(
        `SELECT created_at AS date, COUNT(*) AS count
         FROM customers WHERE created_at BETWEEN ? AND ?
         GROUP BY created_at ORDER BY created_at`,
      )
      .all(from, to) as { date: string; count: number }[]

    // Dư nợ theo khách (point-in-time, toàn thời gian).
    const debtRows = db
      .prepare(
        `SELECT d.customer_id AS cid,
                SUM(d.amount_vnd) - COALESCE((
                  SELECT SUM(p.amount_vnd) FROM debt_payments p
                  JOIN debts d2 ON d2.id = p.debt_id WHERE d2.customer_id = d.customer_id), 0) AS bal
         FROM debts d GROUP BY d.customer_id`,
      )
      .all() as { cid: number; bal: number }[]
    const withDebtCount = debtRows.filter((r) => r.bal > 0).length
    const outstandingVnd = debtRows.reduce((s, r) => s + Math.max(0, r.bal), 0)
    const totalCustomers = (db.prepare(`SELECT COUNT(*) AS c FROM customers`).get() as { c: number }).c

    return {
      byType,
      topCustomers,
      newCustomersSeries,
      debt: { withDebtCount, clearCount: totalCustomers - withDebtCount, outstandingVnd },
    }
  },

  productAnalytics(from: string, to: string): ProductAnalytics {
    const revByTypeRows = db
      .prepare(
        `SELECT p.type AS type, COALESCE(SUM(si.line_total_vnd), 0) AS revenueVnd,
                COALESCE(SUM(si.qty), 0) AS qty
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         WHERE s.sale_date BETWEEN ? AND ?
         GROUP BY p.type`,
      )
      .all(from, to) as { type: ProductType; revenueVnd: number; qty: number }[]
    const revenueByType = (['SERIALIZED', 'QUANTITY'] as ProductType[]).map(
      (t) => revByTypeRows.find((r) => r.type === t) ?? { type: t, revenueVnd: 0, qty: 0 },
    )

    const topProducts = db
      .prepare(
        `SELECT p.name AS name, SUM(si.qty) AS qty, SUM(si.line_total_vnd) AS revenueVnd
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         WHERE s.sale_date BETWEEN ? AND ?
         GROUP BY si.product_id ORDER BY revenueVnd DESC LIMIT 8`,
      )
      .all(from, to) as { name: string; qty: number; revenueVnd: number }[]

    // Tình trạng + giá trị tồn dùng chung danh sách SP (đã tính tồn kho thực tế).
    const products = productsRepo.list().filter((p) => p.active)
    let healthy = 0,
      low = 0,
      out = 0
    for (const p of products) {
      if (p.unitsInStock <= 0) out++
      else if (p.unitsInStock <= p.lowStockThreshold) low++
      else healthy++
    }
    const stockValue = products
      .map((p) => ({ name: p.name, valueVnd: p.costVnd * p.unitsInStock }))
      .filter((r) => r.valueVnd > 0)
      .sort((a, b) => b.valueVnd - a.valueVnd)
      .slice(0, 8)

    return { revenueByType, topProducts, stockStatus: { healthy, low, out }, stockValue }
  },
}
