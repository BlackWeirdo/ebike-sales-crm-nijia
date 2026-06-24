import { beforeEach, describe, expect, it } from 'vitest'
import { dashboardRepo } from './dashboard.ts'
import { salesRepo } from './sales.ts'
import { resetDb, seedQtyProduct, seedSerializedProduct, seedCustomer } from '../test/helpers.ts'

beforeEach(resetDb)

const WIDE = { from: '2000-01-01', to: '2100-01-01' }

// One paid sale (serialized xe) + one underpaid sale (phụ kiện) for a dealer.
function seedSales() {
  const dealer = seedCustomer('dealer')
  const { productId, unitIds } = seedSerializedProduct(2)
  const pk = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
  salesRepo.create({
    customerId: dealer,
    saleDate: '2026-06-10',
    discountVnd: 0,
    paidVnd: 25_000_000,
    paymentMethod: 'cash',
    notes: null,
    dueDate: null,
    items: [{ productId, inventoryUnitId: unitIds[0], qty: 1, unitPriceVnd: 25_000_000, lineDiscountVnd: 0 }],
  })
  salesRepo.create({
    customerId: dealer,
    saleDate: '2026-06-11',
    discountVnd: 0,
    paidVnd: 0, // 300k debt
    paymentMethod: 'cash',
    notes: null,
    dueDate: '2026-07-11',
    items: [{ productId: pk, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
  })
  return { productId, pk }
}

describe('dashboardRepo', () => {
  it('summary totals revenue, count and outstanding debt', () => {
    seedSales()
    const s = dashboardRepo.summary(WIDE.from, WIDE.to)
    expect(s.salesCount).toBe(2)
    expect(s.revenueVnd).toBe(25_300_000)
    expect(s.collectedVnd).toBe(25_000_000)
    expect(s.outstandingDebtVnd).toBe(300_000)
    expect(s.topProducts.length).toBeGreaterThan(0)
    // mỗi top SP phải kèm SKU (để phân biệt SP trùng tên)
    expect(s.topProducts.every((p) => typeof p.sku === 'string' && p.sku.length > 0)).toBe(true)
  })

  it('customerAnalytics returns both types, top customers and debt split', () => {
    seedSales()
    const a = dashboardRepo.customerAnalytics(WIDE.from, WIDE.to)
    expect(a.byType.map((b) => b.type).sort()).toEqual(['dealer', 'individual'])
    expect(a.topCustomers[0].revenueVnd).toBe(25_300_000)
    expect(a.debt.withDebtCount).toBe(1)
    expect(a.debt.outstandingVnd).toBe(300_000)
  })

  it('productAnalytics splits revenue by category (Xe/Phụ kiện) and reports stock status', () => {
    seedSales()
    const a = dashboardRepo.productAnalytics(WIDE.from, WIDE.to)
    const bike = a.revenueByCategory.find((r) => r.category === 'bike')!
    const accessory = a.revenueByCategory.find((r) => r.category === 'accessory')!
    expect(bike.revenueVnd).toBe(25_000_000)
    expect(accessory.revenueVnd).toBe(300_000)
    // 1 serial sold of 2 → 1 in stock; phụ kiện 10-2=8 in stock → both healthy
    expect(a.stockStatus.healthy + a.stockStatus.low + a.stockStatus.out).toBe(2)
    expect(a.stockValue.length).toBeGreaterThan(0)
    // top SP kèm SKU
    expect(a.topProducts.every((p) => typeof p.sku === 'string' && p.sku.length > 0)).toBe(true)
  })

  it('counts a QUANTITY-tracked bike (no serial) as Xe, not Phụ kiện', () => {
    const cust = seedCustomer()
    // A bike sold in bulk: stored as QUANTITY but category = bike.
    const bikeQty = seedQtyProduct({ sku: 'XE-BULK', name: 'Xe bán buôn', category: 'bike', sellingPriceVnd: 10_000_000 })
    salesRepo.create({
      customerId: cust,
      saleDate: '2026-06-10',
      discountVnd: 0,
      paidVnd: 20_000_000,
      paymentMethod: 'cash',
      notes: null,
      dueDate: null,
      items: [{ productId: bikeQty, inventoryUnitId: null, qty: 2, unitPriceVnd: 10_000_000, lineDiscountVnd: 0 }],
    })
    const a = dashboardRepo.productAnalytics(WIDE.from, WIDE.to)
    expect(a.revenueByCategory.find((r) => r.category === 'bike')!.revenueVnd).toBe(20_000_000)
    expect(a.revenueByCategory.find((r) => r.category === 'accessory')!.revenueVnd).toBe(0)
  })

  it('range filter excludes out-of-range sales from revenue', () => {
    seedSales()
    const s = dashboardRepo.summary('2030-01-01', '2030-12-31')
    expect(s.revenueVnd).toBe(0)
    expect(s.salesCount).toBe(0)
    expect(s.outstandingDebtVnd).toBe(300_000) // outstanding is all-time (point-in-time)
  })
})
