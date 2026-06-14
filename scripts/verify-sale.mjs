import puppeteer from 'puppeteer'

const BASE = 'http://localhost:5173'
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push('CONSOLE: ' + m.text()))

const rootLen = () => page.evaluate(() => document.getElementById('root')?.innerText?.length ?? 0)
const clickByText = (txt) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes(t))
    if (b) b.click()
    return !!b
  }, txt)

await page.goto(BASE + '/sales', { waitUntil: 'networkidle0' })

// 1. open form (this is what crashed before)
await clickByText('Tạo đơn bán')
await new Promise((r) => setTimeout(r, 800))
const modalOpen = await page.evaluate(() => !!document.querySelector('.mantine-Modal-content'))
console.log('STEP1 form opened:', modalOpen, 'rootLen=', await rootLen())
await page.screenshot({ path: 'scripts/shots/fix-form-open.png' })

if (modalOpen && errors.length === 0) {
  // 2. pick first product in the "Chọn sản phẩm" select
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => x.placeholder === 'Chọn sản phẩm')
    i?.focus(); i?.click()
  })
  await new Promise((r) => setTimeout(r, 500))
  await page.evaluate(() => {
    const opt = document.querySelector('[role="option"]')
    opt?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    opt?.click()
  })
  await new Promise((r) => setTimeout(r, 500))
  // for serialized product a serial select appears; pick first serial if present
  await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')].find((x) => x.placeholder === 'Chọn serial')
    if (i) { i.focus(); i.click() }
  })
  await new Promise((r) => setTimeout(r, 400))
  await page.evaluate(() => {
    const opt = document.querySelector('[role="option"]')
    if (opt) { opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); opt.click() }
  })
  await new Promise((r) => setTimeout(r, 300))
  // 3. click "Thêm" to add line
  await clickByText('Thêm')
  await new Promise((r) => setTimeout(r, 500))
  const hasLine = await page.evaluate(() => document.body.innerText.includes('Thành tiền'))
  console.log('STEP2 line added, table visible:', hasLine, 'rootLen=', await rootLen())
  await page.screenshot({ path: 'scripts/shots/fix-form-line.png' })
}

console.log('ERRORS:', errors.length)
errors.slice(0, 8).forEach((e) => console.log('  ' + e.slice(0, 200)))
console.log(modalOpen && errors.length === 0 ? 'FIX VERIFIED: form opens, no crash' : 'STILL BROKEN')
await browser.close()
process.exit(errors.length === 0 && modalOpen ? 0 : 1)
