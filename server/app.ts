import express, { type Express } from 'express'
import cors from 'cors'
import './db.ts' // initialize DB + schema on boot
import { productsRouter } from './routes/products.ts'
import { customersRouter } from './routes/customers.ts'
import { salesRouter } from './routes/sales.ts'
import { debtsRouter } from './routes/debts.ts'
import { dashboardRouter } from './routes/dashboard.ts'
import { bankAccountsRouter } from './routes/bank-accounts.ts'
import { errorHandler } from './lib/http.ts'
import { authRouter, requireAuth } from './lib/auth.ts'

/** Build the Express app with all API routes mounted. Static serving + listen live in index.ts. */
export function createApp(): Express {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter) // login/logout/me — public

  app.use(requireAuth) // mọi /api/* bên dưới yêu cầu đăng nhập (khi APP_PASSWORD được set)
  app.use('/api/products', productsRouter)
  app.use('/api/customers', customersRouter)
  app.use('/api/sales', salesRouter)
  app.use('/api/debts', debtsRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/bank-accounts', bankAccountsRouter)

  return app
}

/** Attach the centralized error handler. Call AFTER any static/catch-all routes. */
export function attachErrorHandler(app: Express): void {
  app.use(errorHandler)
}
