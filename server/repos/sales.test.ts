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
    // detail items expose SKU (for the detail modal + printed invoice)
    expect(sale.items[0].productSku).toBe(productsRepo.get(pid)!.sku)
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

  it('persists order-level + line discounts and exposes them on the detail (for modal/invoice)', () => {
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      discountVnd: 20_000, // order-level discount
      paidVnd: 250_000,
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 30_000 }],
    })
    // lineTotal = 2*150k - 30k(line) = 270k; subtotal = sum(lineTotals) = 270k; total = 270k - 20k(order) = 250k
    expect(sale.subtotalVnd).toBe(270_000)
    expect(sale.discountVnd).toBe(20_000)
    expect(sale.totalVnd).toBe(250_000)
    expect(sale.items[0].lineDiscountVnd).toBe(30_000)
    expect(sale.items[0].lineTotalVnd).toBe(270_000)
    // re-fetch to confirm it round-trips through the GET used by the detail modal + invoice
    const fetched = salesRepo.get(sale.id)!
    expect(fetched.discountVnd).toBe(20_000)
    expect(fetched.items[0].lineDiscountVnd).toBe(30_000)
  })

  it('reflects post-sale debt payments in collectedVnd/remainingVnd (invoice paid status)', () => {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      customerId: cid,
      paidVnd: 0, // fully on credit at checkout
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(sale.collectedVnd).toBe(0)
    expect(sale.remainingVnd).toBe(300_000)

    const debt = debtsRepo.getBySale(sale.id)!
    debtsRepo.addPayment(debt.id, { paidAt: '2026-06-12T10:00', amountVnd: 300_000, method: 'cash', notes: null })

    // The invoice now reads collectedVnd/remainingVnd → must show fully paid, no debt.
    const fetched = salesRepo.get(sale.id)!
    expect(fetched.collectedVnd).toBe(300_000)
    expect(fetched.remainingVnd).toBe(0)
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

describe('salesRepo.update', () => {
  it('applies a retroactive order discount: recomputes total + reduces the linked debt', () => {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      customerId: cid,
      paidVnd: 0, // 300k debt, no discount yet
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(sale.totalVnd).toBe(300_000)
    expect(debtsRepo.getBySale(sale.id)!.balanceVnd).toBe(300_000)

    const updated = salesRepo.update(sale.id, {
      ...baseSale,
      customerId: cid,
      discountVnd: 50_000, // now qualifies for a discount
      paidVnd: 0,
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(updated.discountVnd).toBe(50_000)
    expect(updated.totalVnd).toBe(250_000)
    expect(updated.remainingVnd).toBe(250_000)
    expect(debtsRepo.getBySale(sale.id)!.balanceVnd).toBe(250_000)
    expect(productsRepo.get(pid)!.qtyOnHand).toBe(8) // stock unchanged (same items)
  })

  it('reconciles inventory when items change (restores old qty, consumes new)', () => {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      customerId: cid,
      paidVnd: 450_000,
      items: [{ productId: pid, inventoryUnitId: null, qty: 3, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(productsRepo.get(pid)!.qtyOnHand).toBe(7) // 10 - 3

    salesRepo.update(sale.id, {
      ...baseSale,
      customerId: cid,
      paidVnd: 150_000,
      items: [{ productId: pid, inventoryUnitId: null, qty: 1, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(productsRepo.get(pid)!.qtyOnHand).toBe(9) // restored 3, consumed 1 → 10 - 1
  })

  it('frees the old serial and consumes the new one when a serialized line is swapped', () => {
    const cid = seedCustomer()
    const { productId, unitIds } = seedSerializedProduct(2)
    const sale = salesRepo.create({
      ...baseSale,
      customerId: cid,
      paidVnd: 25_000_000,
      items: [{ productId, inventoryUnitId: unitIds[0], qty: 1, unitPriceVnd: 25_000_000, lineDiscountVnd: 0 }],
    })
    expect(productsRepo.availableUnits(productId).map((u) => u.id)).toEqual([unitIds[1]])

    salesRepo.update(sale.id, {
      ...baseSale,
      customerId: cid,
      paidVnd: 25_000_000,
      items: [{ productId, inventoryUnitId: unitIds[1], qty: 1, unitPriceVnd: 25_000_000, lineDiscountVnd: 0 }],
    })
    // unit0 back in stock, unit1 now sold
    expect(productsRepo.availableUnits(productId).map((u) => u.id)).toEqual([unitIds[0]])
  })

  it('refuses to drop already-collected money (paidVnd below what was collected)', () => {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = salesRepo.create({
      ...baseSale,
      customerId: cid,
      paidVnd: 300_000, // paid in full
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
    })
    expect(() =>
      salesRepo.update(sale.id, {
        ...baseSale,
        customerId: cid,
        paidVnd: 0, // would wipe the 300k already collected
        items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
      }),
    ).toThrow(/đã thu/i)
  })

  it('throws on a non-existent sale', () => {
    expect(() =>
      salesRepo.update(999, {
        ...baseSale,
        items: [{ productId: 1, inventoryUnitId: null, qty: 1, unitPriceVnd: 1, lineDiscountVnd: 0 }],
      }),
    ).toThrow(/không tìm thấy/i)
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
