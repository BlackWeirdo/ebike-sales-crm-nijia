import { beforeEach, describe, expect, it } from 'vitest'
import { salesRepo } from './sales.ts'
import { productsRepo } from './products.ts'
import { debtsRepo } from './debts.ts'
import { resetDb, seedQtyProduct, seedSerializedProduct, seedCustomer } from '../test/helpers.ts'

beforeEach(resetDb)

const baseSale = {
  customerId: null as number | null,
  saleDate: '2026-06-10',
  discountVnd: 0,
  paidVnd: 0,
  paymentMethod: 'cash' as const,
  notes: null,
  dueDate: null as string | null,
}

describe('salesRepo.create', () => {
  it('decrements QUANTITY stock and computes totals (paid in full)', () => {
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      paidVnd: 300_000,
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(sale.totalVnd).toBe(300_000)
    expect(sale.remainingVnd).toBe(0)
    expect(productsRepo.get(pid)!.qtyOnHand).toBe(8) // 10 - 2
  })

  it('marks a SERIALIZED unit as sold and excludes it from available', () => {
    const { productId, unitIds } = seedSerializedProduct(2)
    salesRepo.create({
      ...baseSale,
      paidVnd: 25_000_000,
      items: [{ productId, inventoryUnitId: unitIds[0], qty: 1, unitPriceVnd: 25_000_000, lineDiscountVnd: 0 }],
    })
    expect(productsRepo.availableUnits(productId)).toHaveLength(1)
  })

  it('creates a debt when underpaid (and links it to the sale)', () => {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      customerId: cid,
      paidVnd: 100_000, // total 300k → 200k debt
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(sale.remainingVnd).toBe(200_000)
    const debt = debtsRepo.getBySale(sale.id)
    expect(debt).not.toBeNull()
    expect(debt!.balanceVnd).toBe(200_000)
  })

  it('throws when underpaid without a customer', () => {
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    expect(() =>
      salesRepo.create({
        ...baseSale,
        customerId: null,
        paidVnd: 0,
        items: [{ productId: pid, inventoryUnitId: null, qty: 1, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
      }),
    ).toThrow(/khách hàng/i)
  })

  it('throws and rolls back when overselling QUANTITY stock', () => {
    const pid = seedQtyProduct({ qtyOnHand: 1, sellingPriceVnd: 150_000 })
    expect(() =>
      salesRepo.create({
        ...baseSale,
        paidVnd: 0,
        customerId: seedCustomer(),
        items: [{ productId: pid, inventoryUnitId: null, qty: 5, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
      }),
    ).toThrow(/tồn kho/i)
    expect(productsRepo.get(pid)!.qtyOnHand).toBe(1) // unchanged — transaction rolled back
    expect(salesRepo.list()).toHaveLength(0)
  })

  it('throws when a SERIALIZED line has no unit selected', () => {
    const { productId } = seedSerializedProduct(1)
    expect(() =>
      salesRepo.create({
        ...baseSale,
        paidVnd: 25_000_000,
        items: [{ productId, inventoryUnitId: null, qty: 1, unitPriceVnd: 25_000_000, lineDiscountVnd: 0 }],
      }),
    ).toThrow()
  })
})

describe('salesRepo.remove', () => {
  it('restores QUANTITY stock and removes the sale', () => {
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      paidVnd: 300_000,
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(productsRepo.get(pid)!.qtyOnHand).toBe(8)

    salesRepo.remove(sale.id)

    expect(productsRepo.get(pid)!.qtyOnHand).toBe(10) // restored
    expect(salesRepo.list()).toHaveLength(0)
    expect(salesRepo.get(sale.id)).toBeUndefined()
  })

  it('returns a SERIALIZED unit back to stock', () => {
    const { productId, unitIds } = seedSerializedProduct(2)
    const sale = salesRepo.create({
      ...baseSale,
      paidVnd: 25_000_000,
      items: [{ productId, inventoryUnitId: unitIds[0], qty: 1, unitPriceVnd: 25_000_000, lineDiscountVnd: 0 }],
    })
    expect(productsRepo.availableUnits(productId)).toHaveLength(1)

    salesRepo.remove(sale.id)

    expect(productsRepo.availableUnits(productId)).toHaveLength(2) // unit back in stock
  })

  it('deletes the linked debt (and its payments) when removing an unpaid sale', () => {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      customerId: cid,
      paidVnd: 100_000, // 200k debt
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    const debt = debtsRepo.getBySale(sale.id)!
    debtsRepo.addPayment(debt.id, { paidAt: '2026-06-12T10:00', amountVnd: 50_000, method: 'cash', notes: null })

    salesRepo.remove(sale.id)

    expect(debtsRepo.getBySale(sale.id)).toBeNull()
    expect(salesRepo.get(sale.id)).toBeUndefined()
    expect(productsRepo.get(pid)!.qtyOnHand).toBe(10) // stock restored
  })

  it('throws on a non-existent sale', () => {
    expect(() => salesRepo.remove(999)).toThrow(/không tìm thấy/i)
  })
})
