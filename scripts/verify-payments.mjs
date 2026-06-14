import puppeteer from 'puppeteer'

const BASE = 'http://localhost:3001'
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()))

await page.goto(BASE + '/sales', { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 500))

// read the "Còn nợ" of sale #1 before
const before = await page.evaluate(() => document.querySelector('tbody tr')?.innerText ?? '')
console.log('row before:', before.replace(/\n/g, ' | '))

// click the "Thu nợ" cash action on the first row
await page.evaluate(() => {
  const row = document.querySelector('tbody tr')
  const btn = row?.querySelector('button[title="Thu nợ / cập nhật thanh toán"]')
  btn?.click()
})
await new Promise((r) => setTimeout(r, 800))
const modalHasManager = await page.evaluate(() => {
  const t = document.querySelector('.mantine-Modal-content')?.innerText ?? ''
  return t.includes('Thanh toán công nợ') && t.includes('Ngày giờ trả')
})
console.log('sale modal shows payments manager:', modalHasManager)
await page.screenshot({ path: 'scripts/shots/sale-payment-manager.png' })

// fill amount 1000000 and add
await page.evaluate(() => {
  const modal = document.querySelector('.mantine-Modal-content')
  const moneyInput = [...modal.querySelectorAll('input')].find((i) => i.closest('div')?.previousSibling || true)
})
// set the "Số tiền trả" numeric input: find input whose label is "Số tiền trả (₫)"
await page.evaluate(() => {
  const modal = document.querySelector('.mantine-Modal-content')
  const wrappers = [...modal.querySelectorAll('.mantine-InputWrapper-root, .mantine-TextInput-root, .mantine-NumberInput-root')]
  for (const w of wrappers) {
    const label = w.querySelector('label')?.textContent ?? ''
    if (label.includes('Số tiền trả')) {
      const input = w.querySelector('input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, '1.000.000')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
})
await new Promise((r) => setTimeout(r, 400))
// click "Thêm" button inside modal
await page.evaluate(() => {
  const modal = document.querySelector('.mantine-Modal-content')
  ;[...modal.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Thêm')?.click()
})
await new Promise((r) => setTimeout(r, 1200))
const afterModal = await page.evaluate(() => document.querySelector('.mantine-Modal-content')?.innerText ?? '')
console.log('payment row added (has 09: or time / 1.000.000):', afterModal.includes('1.000.000'))
await page.screenshot({ path: 'scripts/shots/sale-after-payment.png' })

// close modal, check the sales row "Còn nợ" decreased
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 800))
const after = await page.evaluate(() => document.querySelector('tbody tr')?.innerText ?? '')
console.log('row after:', after.replace(/\n/g, ' | '))

console.log('ERRORS:', errors.length)
errors.slice(0, 5).forEach((e) => console.log('  ! ' + e.slice(0, 160)))
await browser.close()
const ok = modalHasManager && afterModal.includes('1.000.000') && before !== after && errors.length === 0
console.log(ok ? 'PAYMENT UI VERIFIED OK' : 'PAYMENT UI CHECK INCONCLUSIVE')
