import puppeteer from 'puppeteer'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3001'
const routes = ['/dashboard', '/products', '/sales', '/customers', '/debts']
mkdirSync('scripts/shots', { recursive: true })

const browser = await puppeteer.launch({ headless: 'new' })
let failed = false

for (const route of routes) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 20000 })
  await new Promise((r) => setTimeout(r, 800))
  const rootText = await page.evaluate(() => document.getElementById('root')?.innerText?.length ?? 0)
  const name = route.slice(1)
  await page.screenshot({ path: `scripts/shots/${name}.png` })
  const status = errors.length === 0 && rootText > 50 ? 'OK' : 'CHECK'
  if (status !== 'OK') failed = true
  console.log(`${route} -> ${status} (textLen=${rootText}, errors=${errors.length})`)
  errors.slice(0, 5).forEach((e) => console.log('   ! ' + e.replace(/\s+/g, ' ').slice(0, 160)))
  await page.close()
}

await browser.close()
console.log(failed ? 'UI SMOKE: ISSUES FOUND' : 'UI SMOKE: ALL PAGES RENDER OK')
process.exit(failed ? 1 : 0)
