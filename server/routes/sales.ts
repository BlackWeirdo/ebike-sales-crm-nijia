import { Router } from 'express'
import { z } from 'zod'
import { salesRepo } from '../repos/sales.ts'
import { validateBody } from '../lib/http.ts'

export const salesRouter = Router()

const itemSchema = z.object({
  productId: z.number().int().positive(),
  inventoryUnitId: z.number().int().positive().nullable(),
  qty: z.number().int().positive(),
  unitPriceVnd: z.number().int().min(0),
  lineDiscountVnd: z.number().int().min(0),
})

// Snapshot tài khoản nhận tiền (chỉ-để-in). Chỉ validate SHAPE để chống payload rác,
// KHÔNG đối soát giá trị/tổng (Hướng A: độc lập kế toán).
const paymentAccountSchema = z.object({
  accountId: z.number().int().positive().nullable(),
  label: z.string().max(200),
  bankName: z.string().max(200),
  accountNumber: z.string().max(100),
  accountHolder: z.string().max(200),
  amountVnd: z.number().int().min(0),
})

const createSchema = z.object({
  customerId: z.number().int().positive().nullable(),
  saleDate: z.string().min(1),
  discountVnd: z.number().int().min(0),
  paidVnd: z.number().int().min(0),
  paymentMethod: z.enum(['cash', 'transfer', 'mixed']),
  notes: z.string().nullable(),
  dueDate: z.string().nullable(),
  items: z.array(itemSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
  paymentAccounts: z.array(paymentAccountSchema).optional().default([]),
})

salesRouter.get('/', (_req, res) => res.json(salesRepo.list()))

salesRouter.get('/:id', (req, res) => {
  const s = salesRepo.get(Number(req.params.id))
  if (!s) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })
  res.json(s)
})

salesRouter.post('/', (req, res) => {
  res.status(201).json(salesRepo.create(validateBody(createSchema, req.body)))
})

salesRouter.put('/:id', (req, res) => {
  res.json(salesRepo.update(Number(req.params.id), validateBody(createSchema, req.body)))
})

salesRouter.delete('/:id', (req, res) => {
  salesRepo.remove(Number(req.params.id))
  res.status(204).end()
})
