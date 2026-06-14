import { Router } from 'express'
import { dashboardRepo } from '../repos/dashboard.ts'

export const dashboardRouter = Router()

function range(req: { query: Record<string, unknown> }): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'
  const from = (req.query.from as string) || firstOfMonth
  const to = (req.query.to as string) || today
  return { from, to }
}

dashboardRouter.get('/summary', (req, res) => {
  const { from, to } = range(req)
  res.json(dashboardRepo.summary(from, to))
})

dashboardRouter.get('/revenue-series', (req, res) => {
  const { from, to } = range(req)
  res.json(dashboardRepo.revenueSeries(from, to))
})

dashboardRouter.get('/customer-analytics', (req, res) => {
  const { from, to } = range(req)
  res.json(dashboardRepo.customerAnalytics(from, to))
})

dashboardRouter.get('/product-analytics', (req, res) => {
  const { from, to } = range(req)
  res.json(dashboardRepo.productAnalytics(from, to))
})
