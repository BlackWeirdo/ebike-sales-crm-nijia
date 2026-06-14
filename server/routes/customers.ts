import { Router } from 'express'
import { z } from 'zod'
import { customersRepo } from '../repos/customers.ts'
import { salesRepo } from '../repos/sales.ts'
import { validateBody } from '../lib/http.ts'

export const customersRouter = Router()

const schema = z.object({
  type: z.enum(['individual', 'dealer']).default('individual'),
  name: z.string().min(1, 'Thiếu tên khách hàng'),
  contactPerson: z.string().nullable().optional().default(null),
  taxCode: z.string().nullable().optional().default(null),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
})

customersRouter.get('/', (req, res) => {
  const type = req.query.type === 'individual' || req.query.type === 'dealer' ? req.query.type : undefined
  res.json(customersRepo.list(req.query.search as string | undefined, type))
})

customersRouter.get('/:id', (req, res) => {
  const c = customersRepo.get(Number(req.params.id))
  if (!c) return res.status(404).json({ error: 'Không tìm thấy khách hàng' })
  res.json({ ...c, stats: customersRepo.stats(c.id) })
})

customersRouter.get('/:id/orders', (req, res) => res.json(salesRepo.listByCustomer(Number(req.params.id))))

customersRouter.post('/', (req, res) => {
  res.status(201).json(customersRepo.create(validateBody(schema, req.body)))
})

customersRouter.put('/:id', (req, res) => {
  const updated = customersRepo.update(Number(req.params.id), validateBody(schema, req.body))
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy khách hàng' })
  res.json(updated)
})

customersRouter.delete('/:id', (req, res) => {
  customersRepo.remove(Number(req.params.id))
  res.status(204).end()
})
