import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp, attachErrorHandler } from '../app.ts'
import { resetDb, seedQtyProduct, seedCustomer } from './helpers.ts'

const app = createApp()
attachErrorHandler(app)

beforeEach(resetDb)

const validProduct = {
  sku: 'PK-9',
  name: 'Khoá chống trộm',
  type: 'QUANTITY',
  color: null,
  costVnd: 50_000,
  sellingPriceVnd: 90_000,
  qtyOnHand: 5,
  lowStockThreshold: 2,
  active: 1,
}

describe('API', () => {
  it('GET /api/health → 200', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('POST /api/products validates and rejects bad body → 400 {error}', async () => {
    const res = await request(app).post('/api/products').send({ sku: '', name: '' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('POST /api/products creates → 201, then GET lists it', async () => {
    const created = await request(app).post('/api/products').send(validProduct)
    expect(created.status).toBe(201)
    expect(created.body.id).toBeGreaterThan(0)
    const list = await request(app).get('/api/products')
    expect(list.body).toHaveLength(1)
    expect(list.body[0].unitsInStock).toBe(5)
  })

  it('business error from repo surfaces as 400 {error} (Vietnamese)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .send({
        customerId: null,
        saleDate: '2026-06-10',
        discountVnd: 0,
        paidVnd: 0,
        paymentMethod: 'cash',
        notes: null,
        dueDate: null,
        items: [{ productId: 999999, inventoryUnitId: null, qty: 1, unitPriceVnd: 1000, lineDiscountVnd: 0 }],
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/không tồn tại/i)
  })

  it('GET removed /api/products/low-stock → 404', async () => {
    const res = await request(app).get('/api/products/low-stock')
    expect(res.status).toBe(404)
  })

  it('POST /api/products/import with invalid rows → 422 with error list', async () => {
    const res = await request(app)
      .post('/api/products/import')
      .send({
        products: [{ sku: '', name: '', type: 'QUANTITY', color: null, costVnd: 1, sellingPriceVnd: 1, qtyOnHand: 1, lowStockThreshold: 1 }],
        units: [],
      })
    expect(res.status).toBe(422)
    expect(res.body.ok).toBe(false)
    expect(res.body.errors.length).toBeGreaterThan(0)
  })

  it('full flow: create customer + sale → debt visible via API', async () => {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    const sale = await request(app)
      .post('/api/sales')
      .send({
        customerId: cid,
        saleDate: '2026-06-10',
        discountVnd: 0,
        paidVnd: 100_000,
        paymentMethod: 'cash',
        notes: null,
        dueDate: null,
        items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
      })
    expect(sale.status).toBe(201)
    expect(sale.body.remainingVnd).toBe(200_000)

    const debts = await request(app).get('/api/debts?filter=open')
    expect(debts.body).toHaveLength(1)
    expect(debts.body[0].balanceVnd).toBe(200_000)
  })
})
