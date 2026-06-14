import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'

// Bật auth TRƯỚC khi nạp app.ts (auth.ts đọc APP_PASSWORD lúc import) → dùng dynamic import.
let app: Express

beforeAll(async () => {
  process.env.APP_PASSWORD = 'secret123'
  process.env.SESSION_SECRET = 'test-secret'
  const mod = await import('../app.ts')
  app = mod.createApp()
  mod.attachErrorHandler(app)
})

describe('Auth (single password)', () => {
  it('GET /api/auth/me → authEnabled true, authed false khi chưa đăng nhập', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.body.authEnabled).toBe(true)
    expect(res.body.authed).toBe(false)
  })

  it('chặn route dữ liệu khi chưa đăng nhập → 401', async () => {
    const res = await request(app).get('/api/products')
    expect(res.status).toBe(401)
  })

  it('từ chối sai mật khẩu → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('đăng nhập đúng → set cookie → truy cập được route dữ liệu', async () => {
    const agent = request.agent(app)
    const login = await agent.post('/api/auth/login').send({ password: 'secret123' })
    expect(login.status).toBe(200)
    expect(login.headers['set-cookie']).toBeDefined()

    const protectedRes = await agent.get('/api/products')
    expect(protectedRes.status).toBe(200)

    const me = await agent.get('/api/auth/me')
    expect(me.body.authed).toBe(true)
  })

  it('đăng xuất → mất quyền truy cập', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ password: 'secret123' })
    await agent.post('/api/auth/logout')
    const res = await agent.get('/api/products')
    expect(res.status).toBe(401)
  })
})
