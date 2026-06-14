import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router, type Request, type Response, type NextFunction } from 'express'

// Bảo vệ 1 mật khẩu cho app 1 người dùng khi deploy public.
// APP_PASSWORD trống → auth TẮT (tiện dev/test local, không cần đăng nhập).
const PASSWORD = process.env.APP_PASSWORD || ''
const SECRET = process.env.SESSION_SECRET || PASSWORD || 'dev-secret'
const COOKIE = 'crm_auth'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 ngày

export const authEnabled = PASSWORD.length > 0

// Token phiên = HMAC cố định theo SECRET. Đổi SESSION_SECRET/APP_PASSWORD → mọi phiên cũ vô hiệu.
function expectedToken(): string {
  return createHmac('sha256', SECRET).update('crm-auth-v1').digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}

export function isAuthed(req: Request): boolean {
  if (!authEnabled) return true
  const token = readCookie(req, COOKIE)
  return !!token && safeEqual(token, expectedToken())
}

/** Chặn mọi route /api/* nếu chưa đăng nhập. Route tĩnh/SPA (không phải /api/) luôn cho qua (không chứa dữ liệu). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api/')) return next()
  if (isAuthed(req)) return next()
  res.status(401).json({ error: 'Chưa đăng nhập' })
}

export const authRouter = Router()

authRouter.get('/me', (req, res) => {
  res.json({ authed: isAuthed(req), authEnabled })
})

authRouter.post('/login', (req, res) => {
  if (!authEnabled) return res.json({ ok: true })
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!safeEqual(password, PASSWORD)) {
    return res.status(401).json({ error: 'Sai mật khẩu' })
  }
  res.cookie(COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  })
  res.json({ ok: true })
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})
