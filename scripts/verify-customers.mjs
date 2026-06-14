import puppeteer from 'puppeteer'

const BASE = 'http://localhost:3001'
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()))

await page.goto(BASE + '/customers', { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 600))

// open add form, switch to "Đại lý", confirm dealer fields appear
await page.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.innerText.includes('Thêm khách hàng'))?.click()
})
await new Promise((r) => setTimeout(r, 500))
// click the "Đại lý" segment
await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.mantine-SegmentedControl-label, label')]
  const dealer = labels.find((l) => l.textContent?.trim() === 'Đại lý')
  dealer?.click()
})
await new Promise((r) => setTimeout(r, 400))
const formText = await page.evaluate(() => document.querySelector('.mantine-Modal-content')?.innerText ?? '')
console.log('dealer fields shown (Người liên hệ + Mã số thuế):', formText.includes('Người liên hệ') && formText.includes('Mã số thuế'))
console.log('name label = company:', formText.includes('Tên công ty / đại lý'))
await page.screenshot({ path: 'scripts/shots/cust-dealer-form.png' })

// close modal
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 400))

// filter to "Đại lý" and check list shows the dealer created via API earlier
await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.mantine-SegmentedControl-label, label')]
  labels.find((l) => l.textContent?.trim() === 'Đại lý')?.click()
})
await new Promise((r) => setTimeout(r, 800))
const tableText = await page.evaluate(() => document.querySelector('table')?.innerText ?? '')
console.log('dealer list shows company:', tableText.includes('Minh Anh'))
console.log('dealer list shows MST:', tableText.includes('0312345678'))
console.log('dealer list hides individuals (no Le Thi C):', !tableText.includes('Le Thi C'))
await page.screenshot({ path: 'scripts/shots/cust-list-dealer.png' })

console.log('ERRORS:', errors.length)
errors.slice(0, 5).forEach((e) => console.log('  ! ' + e.slice(0, 160)))
await browser.close()
const ok = errors.length === 0 && tableText.includes('Minh Anh')
console.log(ok ? 'CUSTOMER UI VERIFIED OK' : 'CUSTOMER UI FAILED')
process.exit(ok ? 0 : 1)
