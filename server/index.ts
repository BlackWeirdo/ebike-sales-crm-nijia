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

app.listen(PORT, () => {
  console.log(`[server] API listening on http://localhost:${PORT}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[server] Dev UI: run "npm run dev" → http://localhost:5173`)
  }
})
