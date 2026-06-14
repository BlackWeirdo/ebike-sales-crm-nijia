import { Router } from 'express'
import { z } from 'zod'
import { productsRepo } from '../repos/products.ts'
import { validateBody } from '../lib/http.ts'

export const productsRouter = Router()

const productSchema = z.object({
  sku: z.string().min(1, 'Thiếu mã SKU'),
  name: z.string().min(1, 'Thiếu tên sản phẩm'),
  type: z.enum(['SERIALIZED', 'QUANTITY']),
  color: z.string().nullable().optional().default(null),
  costVnd: z.number().int().min(0),
  sellingPriceVnd: z.number().int().min(0),
  qtyOnHand: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0),
  active: z.number().int().min(0).max(1),
})

const importSchema = z.object({
  products: z.array(
    z.object({
      sku: z.string(),
      name: z.string(),
      type: z.enum(['SERIALIZED', 'QUANTITY']),
      color: z.string().nullable(),
      costVnd: z.number().int().min(0),
      sellingPriceVnd: z.number().int().min(0),
      qtyOnHand: z.number().int().min(0),
      lowStockThreshold: z.number().int().min(0),
    }),
  ),
  units: z.array(
    z.object({
      sku: z.string(),
      serialNumber: z.string(),
      costVnd: z.number().int().min(0),
      acquiredDate: z.string(),
    }),
  ),
})

const unitSchema = z.object({
  serialNumber: z.string().min(1, 'Thiếu số serial'),
  costVnd: z.number().int().min(0),
  acquiredDate: z.string().min(1),
})

productsRouter.get('/', (_req, res) => res.json(productsRepo.list()))

productsRouter.post('/import', (req, res) => {
  const result = productsRepo.importBulk(validateBody(importSchema, req.body))
  res.status(result.ok ? 201 : 422).json(result)
})

productsRouter.get('/:id', (req, res) => {
  const p = productsRepo.get(Number(req.params.id))
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' })
  res.json(p)
})

productsRouter.post('/', (req, res) => {
  res.status(201).json(productsRepo.create(validateBody(productSchema, req.body)))
})

productsRouter.put('/:id', (req, res) => {
  const updated = productsRepo.update(Number(req.params.id), validateBody(productSchema, req.body))
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' })
  res.json(updated)
})

productsRouter.delete('/:id', (req, res) => {
  productsRepo.remove(Number(req.params.id))
  res.status(204).end()
})

// ---- serialized units ----
productsRouter.get('/:id/units', (req, res) => res.json(productsRepo.listUnits(Number(req.params.id))))

productsRouter.get('/:id/units/available', (req, res) =>
  res.json(productsRepo.availableUnits(Number(req.params.id))),
)

productsRouter.post('/:id/units', (req, res) => {
  const { serialNumber, costVnd, acquiredDate } = validateBody(unitSchema, req.body)
  res.status(201).json(productsRepo.addUnit(Number(req.params.id), serialNumber, costVnd, acquiredDate))
})

productsRouter.delete('/units/:unitId', (req, res) => {
  productsRepo.removeUnit(Number(req.params.unitId))
  res.status(204).end()
})
