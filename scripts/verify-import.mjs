import puppeteer from 'puppeteer'
import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'

// 1. Generate a real test .xlsx (fresh skus/serials)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ['Tên', 'SKU', 'Loại', 'Màu', 'GiáNhập', 'GiáBán', 'SốLượng', 'NgưỡngTồn'],
    ['Dat Bike UI', 'XE-DUI', 'Xe', 'Vàng', 19000000, 23000000, '', 1],
    ['Phu kien UI', 'PK-DUI', 'Phụ kiện', 'Cam', 50000, 120000, 40, 5],
  ]),
  'SanPham',
)
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ['SKU', 'Serial', 'GiáNhập', 'NgàyNhập'],
    ['XE-DUI', 'DUI-0001', 19000000, '2026-06-14'],
    ['XE-DUI', 'DUI-0002', 19000000, '2026-06-14'],
    ['XE-DUI', 'DUI-0003', 19000000, '2026-06-14'],
  ]),
  'SerialXe',
)
XLSX.writeFile(wb, 'scripts/test-import.xlsx')
console.log('generated test-import.xlsx')

// 2. Drive the browser
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()))

await page.goto('http://localhost:3001/products', { waitUntil: 'networkidle0' })

// open import modal
await page.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.innerText.includes('Nhập Excel'))?.click()
})
await new Promise((r) => setTimeout(r, 600))
const modalOpen = await page.evaluate(() => !!document.querySelector('.mantine-Modal-content'))
console.log('import modal open:', modalOpen)

// upload file
const input = await page.$('input[type=file]')
await input.uploadFile('scripts/test-import.xlsx')
await new Promise((r) => setTimeout(r, 1500))
const previewText = await page.evaluate(() => document.querySelector('.mantine-Modal-content')?.innerText ?? '')
console.log('preview shows counts:', /2.*sản phẩm.*3.*serial/s.test(previewText) || previewText.includes('Đọc được'))

// click "Nhập dữ liệu"
await page.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Nhập dữ liệu')?.click()
})
await new Promise((r) => setTimeout(r, 1500))
const resultText = await page.evaluate(() => document.querySelector('.mantine-Modal-content')?.innerText ?? '')
const success = resultText.includes('Nhập thành công')
console.log('IMPORT SUCCESS alert:', success)
await page.screenshot({ path: 'scripts/shots/import-result.png' })

// close modal, verify new product row + color column present
await page.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Đóng')?.click()
})
await new Promise((r) => setTimeout(r, 800))
const tableText = await page.evaluate(() => document.querySelector('table')?.innerText ?? '')
console.log('table has new bike (Dat Bike UI):', tableText.includes('Dat Bike UI'))
console.log('table has color Vàng:', tableText.includes('Vàng'))
await page.screenshot({ path: 'scripts/shots/products-after-import.png' })

console.log('ERRORS:', errors.length)
errors.slice(0, 5).forEach((e) => console.log('  ! ' + e.slice(0, 160)))
await browser.close()
console.log(modalOpen && success && errors.length === 0 ? 'IMPORT UI VERIFIED OK' : 'IMPORT UI FAILED')
process.exit(modalOpen && success && errors.length === 0 ? 0 : 1)
