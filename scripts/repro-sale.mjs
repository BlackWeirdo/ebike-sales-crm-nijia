import puppeteer from 'puppeteer'

const BASE = 'http://localhost:5173'
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push('CONSOLE: ' + m.text()))
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')))

function rootLen() {
  return page.evaluate(() => document.getElementById('root')?.innerText?.length ?? 0)
}

await page.goto(BASE + '/sales', { waitUntil: 'networkidle0', timeout: 20000 })
console.log('after load rootLen=', await rootLen())

// Click "Tạo đơn bán"
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Tạo đơn bán'))
  btn?.click()
})
await new Promise((r) => setTimeout(r, 1000))
console.log('after open form rootLen=', await rootLen())
console.log('modal present:', await page.evaluate(() => !!document.querySelector('.mantine-Modal-content')))

await page.screenshot({ path: 'scripts/shots/repro-form.png' })

if (errors.length) {
  console.log('--- ERRORS ---')
  errors.slice(0, 10).forEach((e) => console.log(e.slice(0, 600)))
} else {
  console.log('NO ERRORS on open. Trying to add a product + submit...')
  // Open product select and pick first option
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')]
    const sel = inputs.find((i) => i.placeholder === 'Chọn sản phẩm')
    sel?.focus(); sel?.click()
  })
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: 'scripts/shots/repro-select.png' })
  errors.slice(0, 10).forEach((e) => console.log(e.slice(0, 600)))
}

console.log('final rootLen=', await rootLen())
await browser.close()
