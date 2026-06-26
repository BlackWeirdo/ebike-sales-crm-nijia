import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp, attachErrorHandler } from '../app.ts'
import { resetDb, seedQtyProduct, seedCustomer } from './helpers.ts'

const app = createApp()
attachErrorHandler(app)

beforeEach(resetDb)

const validAccount = {
  label: 'Công ty - VCB',
  bankName: 'Vietcombank',
  accountNumber: '0123456789',
  accountHolder: 'CÔNG TY NIJIA',
  active: 1,
}

describe('Bank accounts CRUD', () => {
  it('rejects empty label → 400', async () => {
    const res = await request(app).post('/api/bank-accounts').send({ label: '' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('create → 201 then GET lists it', async () => {
    const created = await request(app).post('/api/bank-accounts').send(validAccount)
    expect(created.status).toBe(201)
    expect(created.body.id).toBeGreaterThan(0)
    expect(created.body.active).toBe(1)
    const list = await request(app).get('/api/bank-accounts')
    expect(list.body).toHaveLength(1)
    expect(list.body[0].label).toBe('Công ty - VCB')
    expect(list.body[0].accountNumber).toBe('0123456789')
  })

  it('update changes fields', async () => {
    const c = await request(app).post('/api/bank-accounts').send(validAccount)
    const u = await request(app)
      .put(`/api/bank-accounts/${c.body.id}`)
      .send({ ...validAccount, accountHolder: 'NIJIA VIỆT NAM' })
    expect(u.status).toBe(200)
    expect(u.body.accountHolder).toBe('NIJIA VIỆT NAM')
  })

  it('delete = xóa mềm (active=0 nhưng vẫn còn trong list)', async () => {
    const c = await request(app).post('/api/bank-accounts').send(validAccount)
    const d = await request(app).delete(`/api/bank-accounts/${c.body.id}`)
    expect(d.status).toBe(204)
    const list = await request(app).get('/api/bank-accounts')
    expect(list.body).toHaveLength(1) // vẫn hiện (Select đơn bán cần thấy hết)
    expect(list.body[0].active).toBe(0)
  })

  it('PUT not found → 404', async () => {
    const res = await request(app).put('/api/bank-accounts/99999').send(validAccount)
    expect(res.status).toBe(404)
  })
})

// Snapshot tài khoản nhận tiền trên đơn — CHỈ ĐỂ IN, độc lập kế toán (Hướng A).
describe('Sale payment accounts (snapshot, print-only)', () => {
  const accts = [
    { accountId: 1, label: 'Công ty - VCB', bankName: 'VCB', accountNumber: '111', accountHolder: 'NIJIA', amountVnd: 200_000 },
    { accountId: null, label: 'NV Ngọc - MB', bankName: 'MB', accountNumber: '222', accountHolder: 'Ngọc', amountVnd: 100_000 },
  ]

  function saleBody(extra: Record<string, unknown> = {}) {
    const cid = seedCustomer()
    const pid = seedQtyProduct({ qtyOnHand: 10, sellingPriceVnd: 150_000 })
    return {
      customerId: cid,
      saleDate: '2026-06-10',
      discountVnd: 0,
      paidVnd: 100_000,
      paymentMethod: 'transfer',
      notes: null,
      dueDate: null,
      items: [{ productId: pid, inventoryUnitId: null, qty: 2, unitPriceVnd: 150_000, lineDiscountVnd: 0 }],
      ...extra,
    }
  }

  it('lưu paymentAccounts khi tạo + trả lại đúng khi GET', async () => {
    const created = await request(app).post('/api/sales').send(saleBody({ paymentAccounts: accts }))
    expect(created.status).toBe(201)
    expect(created.body.paymentAccounts).toHaveLength(2)
    const got = await request(app).get(`/api/sales/${created.body.id}`)
    expect(got.body.paymentAccounts[0].label).toBe('Công ty - VCB')
    expect(got.body.paymentAccounts[0].amountVnd).toBe(200_000)
    expect(got.body.paymentAccounts[1].accountId).toBeNull() // snapshot giữ TK đã xóa (accountId null)
  })

  it('mặc định [] khi không gửi paymentAccounts', async () => {
    const created = await request(app).post('/api/sales').send(saleBody())
    expect(created.status).toBe(201)
    expect(created.body.paymentAccounts).toEqual([])
  })

  it('KHÔNG ảnh hưởng tiền: total/collected/remaining giữ nguyên dù tổng chia khác', async () => {
    // total = 2 * 150k = 300k; paid 100k → remaining 200k. Tổng chia = 300k (khác paid) nhưng không được đụng tiền.
    const created = await request(app).post('/api/sales').send(saleBody({ paymentAccounts: accts }))
    expect(created.body.totalVnd).toBe(300_000)
    expect(created.body.collectedVnd).toBe(100_000)
    expect(created.body.remainingVnd).toBe(200_000)
  })

  it('KHÔNG ảnh hưởng tồn kho: vẫn trừ đúng 2 đơn vị', async () => {
    await request(app).post('/api/sales').send(saleBody({ paymentAccounts: accts }))
    const products = await request(app).get('/api/products')
    expect(products.body[0].unitsInStock).toBe(8) // 10 - 2
  })

  it('sửa đơn thay paymentAccounts + giữ nguyên tiền (reverse-reapply)', async () => {
    const body = saleBody({ paymentAccounts: accts })
    const created = await request(app).post('/api/sales').send(body)
    const upd = await request(app)
      .put(`/api/sales/${created.body.id}`)
      .send({ ...body, paymentAccounts: [accts[0]] })
    expect(upd.status).toBe(200)
    expect(upd.body.paymentAccounts).toHaveLength(1)
    expect(upd.body.remainingVnd).toBe(200_000) // tiền không đổi
    // tồn kho vẫn đúng sau reverse-reapply
    const products = await request(app).get('/api/products')
    expect(products.body[0].unitsInStock).toBe(8)
  })

  it('sửa đơn xóa hết paymentAccounts → []', async () => {
    const body = saleBody({ paymentAccounts: accts })
    const created = await request(app).post('/api/sales').send(body)
    const upd = await request(app)
      .put(`/api/sales/${created.body.id}`)
      .send({ ...body, paymentAccounts: [] })
    expect(upd.body.paymentAccounts).toEqual([])
  })
})
