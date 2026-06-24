import { db } from '../db.ts'
import { productsRepo } from '../repos/products.ts'
import { customersRepo } from '../repos/customers.ts'

const TABLES = ['debt_payments', 'debts', 'sale_items', 'sales', 'inventory_units', 'products', 'customers']

/** Wipe all rows + reset autoincrement counters. Call in beforeEach for per-test isolation. */
export function resetDb(): void {
  for (const t of TABLES) db.exec(`DELETE FROM ${t}`)
  db.exec(`DELETE FROM sqlite_sequence`)
}

/** Seed one QUANTITY product (phụ kiện) with stock; returns its id. */
export function seedQtyProduct(overrides: Partial<Parameters<typeof productsRepo.create>[0]> = {}): number {
  return productsRepo.create({
    sku: 'PK-01',
    name: 'Mũ bảo hiểm',
    type: 'QUANTITY',
    category: 'accessory',
    color: null,
    costVnd: 80_000,
    sellingPriceVnd: 150_000,
    qtyOnHand: 10,
    lowStockThreshold: 3,
    active: 1,
    ...overrides,
  }).id
}

/** Seed one SERIALIZED product (xe) + N serial units in stock; returns {productId, unitIds}. */
export function seedSerializedProduct(unitCount = 2): { productId: number; unitIds: number[] } {
  const productId = productsRepo.create({
    sku: 'XE-01',
    name: 'Xe VinFast Klara',
    type: 'SERIALIZED',
    category: 'bike',
    color: 'Đỏ',
    costVnd: 20_000_000,
    sellingPriceVnd: 25_000_000,
    qtyOnHand: 0,
    lowStockThreshold: 1,
    active: 1,
  }).id
  const unitIds: number[] = []
  for (let i = 1; i <= unitCount; i++) {
    unitIds.push(productsRepo.addUnit(productId, `SN-000${i}`, 20_000_000, '2026-06-01').id)
  }
  return { productId, unitIds }
}

/** Seed one customer; returns its id. */
export function seedCustomer(type: 'individual' | 'dealer' = 'individual'): number {
  return customersRepo.create({
    type,
    name: type === 'dealer' ? 'Công ty ABC' : 'Nguyễn Văn A',
    contactPerson: type === 'dealer' ? 'Anh B' : null,
    taxCode: type === 'dealer' ? '0101234567' : null,
    phone: '0900000000',
    email: null,
    address: null,
    notes: null,
  }).id
}
