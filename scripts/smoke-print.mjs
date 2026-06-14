import puppeteer from 'puppeteer'

const BASE = 'http://localhost:3001'
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })

// Capture the invoice popup opened by window.open + document.write.
const popupPromise = new Promise((resolve) => browser.once('targetcreated', (t) => resolve(t)))

await page.goto(BASE + '/sales', { waitUntil: 'networkidle0', timeout: 20000 })
await page.waitForSelector('button[title="In hóa đơn"]', { timeout: 10000 })
await page.click('button[title="In hóa đơn"]')

const target = await popupPromise
const popup = await target.page()
await new Promise((r) => setTimeout(r, 800))
const text = await popup.evaluate(() => document.body?.innerText ?? '')
await popup.screenshot({ path: 'scripts/shots/invoice.png' })
console.log('invoice textLen=', text.length)
console.log('has HOA DON:', text.includes('HÓA ĐƠN'))
console.log('has TONG CONG:', text.includes('TỔNG CỘNG'))
console.log('has Con no:', text.includes('Còn nợ'))
await browser.close()
console.log(text.length > 100 ? 'PRINT INVOICE: OK' : 'PRINT INVOICE: ISSUE')
