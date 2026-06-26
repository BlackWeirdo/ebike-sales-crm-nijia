import { Router } from 'express'
import { dashboardRepo } from '../repos/dashboard.ts'
import { today } from '../lib/date.ts'

export const dashboardRouter = Router()

function range(req: { query: Record<string, unknown> }): { from: string; to: string } {
  const todayStr = today()
  const firstOfMonth = todayStr.slice(0, 8) + '01'
  const from = (req.query.from as string) || firstOfMonth
  const to = (req.query.to as string) || todayStr
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
