import { beforeEach, describe, expect, it } from 'vitest'
import { productsRepo } from './products.ts'
import { resetDb, seedQtyProduct, seedSerializedProduct } from '../test/helpers.ts'

beforeEach(resetDb)

describe('productsRepo', () => {
  it('creates a product and lists it with computed stock', () => {
    seedQtyProduct({ qtyOnHand: 7 })
    const list = productsRepo.list()
    expect(list).toHaveLength(1)
    expect(list[0].unitsInStock).toBe(7) // QUANTITY → qtyOnHand
  })

  it('computes unitsInStock from in_stock serial units for SERIALIZED', () => {
    const { productId } = seedSerializedProduct(3)
    const p = productsRepo.list().find((x) => x.id === productId)!
    expect(p.unitsInStock).toBe(3)
  })

  it('updates fields', () => {
    const id = seedQtyProduct()
    productsRepo.update(id, {
      sku: 'PK-01',
      name: 'Mũ bảo hiểm (mới)',
      type: 'QUANTITY',
      color: 'Đen',
      costVnd: 90_000,
      sellingPriceVnd: 160_000,
      qtyOnHand: 5,
      lowStockThreshold: 2,
      active: 1,
    })
    const p = productsRepo.get(id)!
    expect(p.name).toBe('Mũ bảo hiểm (mới)')
    expect(p.sellingPriceVnd).toBe(160_000)
  })

  it('addUnit adds an in_stock unit; removeUnit only removes in_stock', () => {
    const { productId, unitIds } = seedSerializedProduct(2)
    expect(productsRepo.availableUnits(productId)).toHaveLength(2)
    productsRepo.removeUnit(unitIds[0])
    expect(productsRepo.availableUnits(productId)).toHaveLength(1)
  })

  it('lowStock flags active products at/below threshold', () => {
    seedQtyProduct({ sku: 'A', qtyOnHand: 2, lowStockThreshold: 3 }) // low
    seedQtyProduct({ sku: 'B', qtyOnHand: 9, lowStockThreshold: 3 }) // ok
    seedQtyProduct({ sku: 'C', qtyOnHand: 0, lowStockThreshold: 3, active: 0 }) // inactive → excluded
    const low = productsRepo.lowStock()
    expect(low.map((p) => p.sku)).toEqual(['A'])
  })

  describe('importBulk', () => {
    it('imports valid products + serial units', () => {
      const res = productsRepo.importBulk({
        products: [
          { sku: 'XE-1', name: 'Xe A', type: 'SERIALIZED', color: null, costVnd: 1, sellingPriceVnd: 2, qtyOnHand: 0, lowStockThreshold: 1 },
          { sku: 'PK-1', name: 'PK A', type: 'QUANTITY', color: null, costVnd: 1, sellingPriceVnd: 2, qtyOnHand: 5, lowStockThreshold: 1 },
        ],
        units: [{ sku: 'XE-1', serialNumber: 'S1', costVnd: 1, acquiredDate: '2026-06-01' }],
      })
      expect(res.ok).toBe(true)
      expect(res.productsCreated).toBe(2)
      expect(res.unitsCreated).toBe(1)
      expect(productsRepo.list()).toHaveLength(2)
    })

    it('is all-or-nothing: any invalid row writes nothing', () => {
      const res = productsRepo.importBulk({
        products: [
          { sku: 'OK-1', name: 'Hợp lệ', type: 'QUANTITY', color: null, costVnd: 1, sellingPriceVnd: 2, qtyOnHand: 1, lowStockThreshold: 1 },
          { sku: '', name: '', type: 'QUANTITY', color: null, costVnd: 1, sellingPriceVnd: 2, qtyOnHand: 1, lowStockThreshold: 1 }, // invalid
        ],
        units: [],
      })
      expect(res.ok).toBe(false)
      expect(res.errors.length).toBeGreaterThan(0)
      expect(productsRepo.list()).toHaveLength(0) // nothing written
    })

    it('flags a serial referencing a non-serialized SKU', () => {
      const res = productsRepo.importBulk({
        products: [{ sku: 'PK-1', name: 'PK', type: 'QUANTITY', color: null, costVnd: 1, sellingPriceVnd: 2, qtyOnHand: 1, lowStockThreshold: 1 }],
        units: [{ sku: 'PK-1', serialNumber: 'S1', costVnd: 1, acquiredDate: '2026-06-01' }],
      })
      expect(res.ok).toBe(false)
      expect(res.errors.some((e) => e.sheet === 'SerialXe')).toBe(true)
    })
  })
})
