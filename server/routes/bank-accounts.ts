import { Router } from 'express'
import { z } from 'zod'
import { bankAccountsRepo } from '../repos/bankAccounts.ts'
import { validateBody } from '../lib/http.ts'

export const bankAccountsRouter = Router()

const schema = z.object({
  label: z.string().min(1, 'Thiếu tên gợi nhớ tài khoản').max(200),
  bankName: z.string().max(200).default(''),
  accountNumber: z.string().max(100).default(''),
  accountHolder: z.string().max(200).default(''),
  active: z.number().int().min(0).max(1).default(1),
})

bankAccountsRouter.get('/', (_req, res) => res.json(bankAccountsRepo.list()))

bankAccountsRouter.get('/:id', (req, res) => {
  const a = bankAccountsRepo.get(Number(req.params.id))
  if (!a) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })
  res.json(a)
})

bankAccountsRouter.post('/', (req, res) => {
  res.status(201).json(bankAccountsRepo.create(validateBody(schema, req.body)))
})

bankAccountsRouter.put('/:id', (req, res) => {
  const updated = bankAccountsRepo.update(Number(req.params.id), validateBody(schema, req.body))
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })
  res.json(updated)
})

// Xóa mềm (active=0)
bankAccountsRouter.delete('/:id', (req, res) => {
  bankAccountsRepo.remove(Number(req.params.id))
  res.status(204).end()
})
