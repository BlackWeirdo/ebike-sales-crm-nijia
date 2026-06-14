import { Router } from 'express'
import { z } from 'zod'
import { debtsRepo } from '../repos/debts.ts'
import { validateBody } from '../lib/http.ts'

export const debtsRouter = Router()

const paymentSchema = z.object({
  paidAt: z.string().min(1, 'Thiếu ngày giờ thanh toán'),
  amountVnd: z.number().int().positive(),
  method: z.enum(['cash', 'transfer']),
  notes: z.string().nullable().optional().default(null),
})

debtsRouter.get('/', (req, res) => {
  const filter = (req.query.filter as 'all' | 'open' | 'paid') ?? 'all'
  res.json(debtsRepo.list(filter))
})

debtsRouter.get('/aging', (_req, res) => res.json(debtsRepo.aging()))

debtsRouter.get('/:id', (req, res) => {
  const d = debtsRepo.get(Number(req.params.id))
  if (!d) return res.status(404).json({ error: 'Không tìm thấy công nợ' })
  res.json({ ...d, payments: debtsRepo.payments(d.id) })
})

debtsRouter.post('/:id/payments', (req, res) => {
  res.status(201).json(debtsRepo.addPayment(Number(req.params.id), validateBody(paymentSchema, req.body)))
})

debtsRouter.put('/:id/payments/:paymentId', (req, res) => {
  res.json(debtsRepo.updatePayment(Number(req.params.paymentId), validateBody(paymentSchema, req.body)))
})

debtsRouter.delete('/:id/payments/:paymentId', (req, res) => {
  debtsRepo.deletePayment(Number(req.params.paymentId))
  res.status(204).end()
})
