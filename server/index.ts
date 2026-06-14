import express from 'express'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { createApp, attachErrorHandler } from './app.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001

const app = createApp()

// In production, serve the built client from /dist.
const distDir = join(__dirname, '..', 'dist')
if (process.env.NODE_ENV === 'production' && existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')))
}

// Centralized error handler — repo/validation throws become JSON {error} responses.
attachErrorHandler(app)

// Bind 0.0.0.0 để fly-proxy (và mạng LAN) kết nối được — không chỉ localhost.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] API listening on http://0.0.0.0:${PORT}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[server] Dev UI: run "npm run dev" → http://localhost:5173`)
  }
})
