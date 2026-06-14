import { beforeEach, describe, expect, it } from 'vitest'
import { customersRepo } from './customers.ts'
import { salesRepo } from './sales.ts'
import { resetDb, seedCustomer, seedQtyProduct } from '../test/helpers.ts'

beforeEach(resetDb)

describe('customersRepo', () => {
  it('creates individual and dealer; filters by type and search', () => {
    seedCustomer('individual')
    seedCustomer('dealer')
    expect(customersRepo.list()).toHaveLength(2)
    expect(customersRepo.list(undefined, 'dealer')).toHaveLength(1)
    expect(customersRepo.list('ABC')).toHaveLength(1) // dealer name "Công ty ABC"
  })

  it('stats aggregate purchases, spend and outstanding debt', () => {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    salesRepo.create({
      customerId: cid,
      saleDate: '2026-06-10',
      discountVnd: 0,
      paidVnd: 100_000, // 300k total → 200k debt
      paymentMethod: 'cash',
      notes: null,
      dueDate: null,
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    const stats = customersRepo.stats(cid)
    expect(stats.purchaseCount).toBe(1)
    expect(stats.totalSpentVnd).toBe(300_000)
    expect(stats.outstandingDebtVnd).toBe(200_000)
  })
})
