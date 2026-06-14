import puppeteer from 'puppeteer'

const BASE = 'http://localhost:5173'
const browser = await puppeteer.launch({ headless: 'new' })

async function check(route, openFn, label) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()))
  await page.goto(BASE + route, { waitUntil: 'networkidle0' })
  await openFn(page)
  await new Promise((r) => setTimeout(r, 800))
  const modal = await page.evaluate(() => !!document.querySelector('.mantine-Modal-content'))
  const rootLen = await page.evaluate(() => document.getElementById('root')?.innerText?.length ?? 0)
  console.log(`${label}: modal=${modal} rootLen=${rootLen} errors=${errors.length}`)
  errors.slice(0, 3).forEach((e) => console.log('   ! ' + e.slice(0, 160)))
  await page.close()
  return modal && errors.length === 0
}

// Inventory: open serial units modal (the bike icon button on a SERIALIZED product row)
const r1 = await check('/products', async (page) => {
  await page.waitForSelector('table', { timeout: 8000 })
  await page.evaluate(() => {
    const btn = document.querySelector('button[title="Quản lý serial"]')
    btn?.click()
  })
}, 'INVENTORY units modal')

// Debts: open payment modal (the cash icon on an open debt row)
const r2 = await check('/debts', async (page) => {
  await page.waitForSelector('table', { timeout: 8000 })
  await page.evaluate(() => {
    // the teal "thu nợ" action icon is the 2nd action in the row
    const icons = [...document.querySelectorAll('tbody button')]
    icons[icons.length - 1]?.click()
  })
}, 'DEBT payment modal')

await browser.close()
console.log(r1 && r2 ? 'BOTH MODALS OK' : 'A MODAL FAILED')
process.exit(r1 && r2 ? 0 : 1)
