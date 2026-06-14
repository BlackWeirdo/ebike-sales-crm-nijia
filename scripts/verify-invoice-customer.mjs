import puppeteer from 'puppeteer'

const BASE = 'http://localhost:3001'
const API = BASE + '/api'
const H = { 'Content-Type': 'application/json' }
const get = (p) => fetch(API + p).then((r) => r.json())
const post = (p, b) => fetch(API + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json())

// 1. Ensure a dealer sale exists (create one for an existing dealer + quantity product in stock)
const customers = await get('/customers?type=dealer')
const dealer = customers[0]
if (!dealer) {
  console.log('NO DEALER CUSTOMER — abort')
  process.exit(1)
}
const products = await get('/products')
const qtyProd = products.find((p) => p.type === 'QUANTITY' && p.unitsInStock > 0)
const sale = await post('/sales', {
  customerId: dealer.id,
  saleDate: '2026-06-14',
  discountVnd: 0,
  paidVnd: qtyProd.sellingPriceVnd, // pay full → no debt noise
  paymentMethod: 'transfer',
  notes: 'Ban cho dai ly',
  dueDate: null,
  items: [{ productId: qtyProd.id, inventoryUnitId: null, qty: 1, unitPriceVnd: qtyProd.sellingPriceVnd, lineDiscountVnd: 0 }],
})
console.log('dealer sale id:', sale.id, 'customer:', dealer.name, 'MST:', dealer.taxCode)

const browser = await puppeteer.launch({ headless: 'new' })

async function captureInvoice(saleId, shotName) {
  const page = await browser.newPage()
  await page.setViewport({ width: 900, height: 1100 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const popupP = new Promise((resolve) => browser.once('targetcreated', (t) => resolve(t)))
  await page.goto(`${BASE}/sales`, { waitUntil: 'networkidle0' })
  // print the specific sale row
  await page.evaluate((id) => {
    const rows = [...document.querySelectorAll('tbody tr')]
    const row = rows.find((r) => r.innerText.trim().startsWith('#' + id + '\t') || r.innerText.includes('#' + id + '\t'))
    const target = row ?? rows[0]
    target.querySelector('button[title="In hóa đơn"]')?.click()
  }, saleId)
  const popup = await popupP
  const pp = await popup.page()
  await new Promise((r) => setTimeout(r, 900))
  const text = await pp.evaluate(() => document.body.innerText)
  await pp.screenshot({ path: `scripts/shots/${shotName}.png` })
  await pp.close()
  await page.close()
  return { text, errors }
}

// dealer invoice = the just-created sale (top row)
const dealerInv = await captureInvoice(sale.id, 'invoice-dealer')
console.log('DEALER invoice has "đại lý":', /đại lý/i.test(dealerInv.text))
console.log('DEALER invoice has Mã số thuế:', dealerInv.text.includes('Mã số thuế'))
console.log('DEALER invoice has taxCode value:', dealerInv.text.includes(dealer.taxCode ?? '###'))
console.log('DEALER invoice has company name:', dealerInv.text.includes(dealer.name))

// individual invoice = sale #1
const indivInv = await captureInvoice(1, 'invoice-individual')
console.log('INDIVIDUAL invoice has name:', indivInv.text.includes('Nguyen Van A'))
console.log('INDIVIDUAL invoice has NO Mã số thuế:', !indivInv.text.includes('Mã số thuế'))

await browser.close()
const ok =
  /đại lý/i.test(dealerInv.text) &&
  dealerInv.text.includes('Mã số thuế') &&
  dealerInv.text.includes(dealer.taxCode ?? '###') &&
  indivInv.text.includes('Nguyen Van A') &&
  !indivInv.text.includes('Mã số thuế')
console.log(ok ? 'INVOICE CUSTOMER DETAIL VERIFIED OK' : 'CHECK FAILED')
process.exit(ok ? 0 : 1)
