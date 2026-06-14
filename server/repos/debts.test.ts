import { beforeEach, describe, expect, it } from 'vitest'
import { debtsRepo } from './debts.ts'
import { salesRepo } from './sales.ts'
import { resetDb, seedQtyProduct, seedCustomer } from '../test/helpers.ts'

beforeEach(resetDb)

// Create a sale that leaves a 200k debt; return the debt id.
function makeDebt(): number {
  const cid = seedCustomer()
  const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
  const sale = salesRepo.create({
    customerId: cid,
    saleDate: '2026-06-10',
    discountVnd: 0,
    paidVnd: 100_000,
    paymentMethod: 'cash',
    notes: null,
    dueDate: '2026-07-10',
    items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
  })
  return debtsRepo.getBySale(sale.id)!.id
}

describe('debtsRepo payments', () => {
  it('records a partial payment → status partial, balance reduced', () => {
    const id = makeDebt()
    const after = debtsRepo.addPayment(id, { paidAt: '2026-06-15T09:00', amountVnd: 50_000, method: 'cash', notes: null })
    expect(after.paidVnd).toBe(50_000)
    expect(after.balanceVnd).toBe(150_000)
    expect(after.status).toBe('partial')
  })

  it('marks paid when fully settled', () => {
    const id = makeDebt()
    debtsRepo.addPayment(id, { paidAt: '2026-06-15T09:00', amountVnd: 200_000, method: 'transfer', notes: null })
    expect(debtsRepo.get(id)!.status).toBe('paid')
    expect(debtsRepo.get(id)!.balanceVnd).toBe(0)
  })

  it('rejects a payment exceeding the remaining balance', () => {
    const id = makeDebt()
    expect(() => debtsRepo.addPayment(id, { paidAt: '2026-06-15T09:00', amountVnd: 999_999, method: 'cash', notes: null })).toThrow(
      /vượt quá/i,
    )
  })

  it('updates a payment and recomputes balance', () => {
    const id = makeDebt()
    debtsRepo.addPayment(id, { paidAt: '2026-06-15T09:00', amountVnd: 50_000, method: 'cash', notes: null })
    const paymentId = debtsRepo.payments(id)[0].id
    debtsRepo.updatePayment(paymentId, { paidAt: '2026-06-16T09:00', amountVnd: 120_000, method: 'cash', notes: null })
    expect(debtsRepo.get(id)!.balanceVnd).toBe(80_000)
  })

  it('deletes a payment and restores the balance', () => {
    const id = makeDebt()
    debtsRepo.addPayment(id, { paidAt: '2026-06-15T09:00', amountVnd: 50_000, method: 'cash', notes: null })
    const paymentId = debtsRepo.payments(id)[0].id
    debtsRepo.deletePayment(paymentId)
    expect(debtsRepo.get(id)!.balanceVnd).toBe(200_000)
    expect(debtsRepo.get(id)!.status).toBe('open')
  })

  it('aging report totals only outstanding debts', () => {
    makeDebt() // 200k outstanding
    const aging = debtsRepo.aging()
    expect(aging.openCount).toBe(1)
    expect(aging.totalOutstandingVnd).toBe(200_000)
  })
})
