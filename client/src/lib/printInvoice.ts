import type { SaleDetail } from '@shared/types'
import { formatVnd, formatDate } from './format.ts'
import { SHOP } from './shopConfig.ts'
import { toastError } from './notify.ts'

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  mixed: 'Kết hợp',
}

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

/**
 * Load the shop logo as a data URI so it renders reliably inside the print popup
 * (external <img> often doesn't load before the print dialog fires). Returns null on any failure.
 */
async function loadLogoDataUrl(url: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    // Guard: when the logo file is missing, the SPA catch-all returns index.html (200).
    // Only accept a real image so the invoice shows nothing instead of a broken-image icon.
    if (!blob.type.startsWith('image/')) return null
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Detailed, type-aware customer block. Dealers show company + tax code (MST) + contact for VAT reconciliation.
function customerBlock(sale: SaleDetail): string {
  const c = sale.customer
  const line = (label: string, value: string) =>
    `<tr><td class="lbl">${label}</td><td>${value}</td></tr>`
  const dots = '.................................................'

  if (!c) {
    return `<div class="cust-title">Khách hàng</div>
      <table class="cust-table">${line('Khách hàng', esc(sale.customerName ?? 'Khách lẻ'))}</table>`
  }

  const rows: string[] = []
  if (c.type === 'dealer') {
    rows.push(line('Đại lý / Công ty', `<b>${esc(c.name)}</b>`))
    rows.push(line('Mã số thuế', `<b>${esc(c.taxCode) || dots}</b>`)) // always shown for VAT
    if (c.contactPerson) rows.push(line('Người liên hệ', esc(c.contactPerson)))
    rows.push(line('Địa chỉ', esc(c.address) || dots))
    if (c.phone) rows.push(line('Điện thoại', esc(c.phone)))
    if (c.email) rows.push(line('Email', esc(c.email)))
  } else {
    rows.push(line('Khách hàng', `<b>${esc(c.name)}</b>`))
    if (c.phone) rows.push(line('Điện thoại', esc(c.phone)))
    if (c.address) rows.push(line('Địa chỉ', esc(c.address)))
  }
  const title = c.type === 'dealer' ? 'Thông tin khách hàng (đại lý)' : 'Thông tin khách hàng'
  return `<div class="cust-title">${title}</div><table class="cust-table">${rows.join('')}</table>`
}

// Khối "Thông tin chuyển khoản" — chỉ dẫn khách chuyển tiền vào (các) tài khoản. Chỉ hiện khi có dữ liệu.
function paymentAccountsBlock(sale: SaleDetail): string {
  const accts = sale.paymentAccounts ?? []
  if (accts.length === 0) return ''
  const rows = accts
    .map(
      (a) => `
      <tr>
        <td>${esc(a.label)}</td>
        <td>${esc(a.bankName)}</td>
        <td>${esc(a.accountNumber)}</td>
        <td>${esc(a.accountHolder)}</td>
        <td style="text-align:right">${formatVnd(a.amountVnd)}</td>
      </tr>`,
    )
    .join('')
  return `
  <div class="cust-title" style="margin-top:16px">Thông tin chuyển khoản</div>
  <table>
    <thead><tr>
      <th>Tài khoản</th><th>Ngân hàng</th><th>Số tài khoản</th><th>Chủ tài khoản</th>
      <th style="width:130px;text-align:right">Số tiền</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function buildInvoiceHtml(sale: SaleDetail, logo: string | null): string {
  // collectedVnd / remainingVnd account for post-sale debt payments; paidVnd is only the at-checkout amount.
  const collected = sale.collectedVnd
  const balance = sale.remainingVnd
  // Show the per-line discount column only when at least one line actually has a discount.
  const hasLineDiscount = sale.items.some((it) => it.lineDiscountVnd > 0)
  const rows = sale.items
    .map(
      (it, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(it.productName)}${it.productSku ? ` - ${esc(it.productSku)}` : ''}${it.serialNumber ? `<div class="sn">SN: ${esc(it.serialNumber)}</div>` : ''}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:right">${formatVnd(it.unitPriceVnd)}</td>
        ${hasLineDiscount ? `<td style="text-align:right">${it.lineDiscountVnd > 0 ? `- ${formatVnd(it.lineDiscountVnd)}` : '-'}</td>` : ''}
        <td style="text-align:right">${formatVnd(it.lineTotalVnd)}</td>
      </tr>`,
    )
    .join('')

  const shopInfoLines = SHOP.infoLines
    .filter((l) => l && l.trim())
    .map((l) => `<div>${esc(l)}</div>`)
    .join('')

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn #${sale.id}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 24px; font-size: 14px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
          border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px; }
  .shop-info { text-align: left; }
  .shop-name { font-size: 20px; font-weight: 700; color: #0d9488; margin-bottom: 4px; }
  .shop-info div { font-size: 12px; color: #555; line-height: 1.5; }
  .logo-wrap { flex-shrink: 0; text-align: right; }
  .logo-wrap img { max-height: 84px; max-width: 200px; object-fit: contain; }
  h1 { font-size: 22px; text-align: center; letter-spacing: 1px; margin: 8px 0 4px; }
  .inv-meta { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 12px; }
  .cust-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #0d9488; margin: 4px 0; }
  .cust-table { border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
  .cust-table td { border: none; padding: 2px 0; vertical-align: top; }
  .cust-table .lbl { color: #666; padding-right: 14px; white-space: nowrap; width: 140px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 7px 9px; }
  th { background: #f0fdfa; text-align: left; font-size: 13px; }
  .sn { font-size: 11px; color: #777; }
  .totals { margin-top: 14px; margin-left: auto; width: 280px; font-size: 14px; }
  .totals .row { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { font-weight: 700; font-size: 17px; color: #0d9488; border-top: 1px solid #ccc; padding-top: 6px; margin-top: 4px; }
  .debt { color: #dc2626; font-weight: 700; }
  .note { margin-top: 28px; font-style: italic; color: #555; font-size: 13px; }
  .sign { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; font-size: 13px; }
  .sign div { width: 45%; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="head">
    <div class="shop-info">
      <div class="shop-name">${esc(SHOP.name)}</div>
      ${shopInfoLines}
    </div>
    <div class="logo-wrap">
      ${logo ? `<img src="${logo}" alt="logo" />` : ''}
    </div>
  </div>
  <h1>PHIẾU BÁN HÀNG</h1>
  <div class="inv-meta">
    <div><b>Số HĐ:</b> #${sale.id} &nbsp;&nbsp; <b>Ngày:</b> ${formatDate(sale.saleDate)}</div>
    <div><b>Thanh toán:</b> ${PAYMENT_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</div>
  </div>
  ${customerBlock(sale)}
  <table>
    <thead><tr>
      <th style="width:36px;text-align:center">STT</th><th>Sản phẩm</th>
      <th style="width:50px;text-align:center">SL</th>
      <th style="width:120px;text-align:right">Đơn giá</th>
      ${hasLineDiscount ? `<th style="width:110px;text-align:right">Giảm</th>` : ''}
      <th style="width:130px;text-align:right">Thành tiền</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Tạm tính</span><span>${formatVnd(sale.subtotalVnd)}</span></div>
    ${sale.discountVnd > 0 ? `<div class="row"><span>Giảm giá</span><span>- ${formatVnd(sale.discountVnd)}</span></div>` : ''}
    <div class="row grand"><span>TỔNG CỘNG</span><span>${formatVnd(sale.totalVnd)}</span></div>
    <div class="row"><span>Khách trả</span><span>${formatVnd(collected)}</span></div>
    ${balance > 0 ? `<div class="row debt"><span>Còn nợ</span><span>${formatVnd(balance)}</span></div>` : ''}
  </div>
  ${paymentAccountsBlock(sale)}
  ${sale.notes ? `<div class="note">Ghi chú: ${esc(sale.notes)}</div>` : ''}
  <div class="note">${esc(SHOP.note)}</div>
  <div class="sign">
    <div><b>Khách hàng</b><br/><span style="color:#888">(Ký, ghi rõ họ tên)</span></div>
    <div><b>Người bán</b><br/><span style="color:#888">(Ký, ghi rõ họ tên)</span></div>
  </div>
</body></html>`
}

/** Open a clean print window for one sale and trigger the browser print dialog. */
export async function printSaleInvoice(sale: SaleDetail): Promise<void> {
  // Open the window synchronously (within the click gesture) to avoid pop-up blocking,
  // then load the logo asynchronously before writing the final document.
  const win = window.open('', '_blank', 'width=820,height=920')
  if (!win) {
    toastError(new Error('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up rồi thử lại.'))
    return
  }
  win.document.write('<p style="font-family:sans-serif;padding:24px;color:#555">Đang chuẩn bị hóa đơn...</p>')

  const logo = await loadLogoDataUrl(SHOP.logoUrl)
  const html = buildInvoiceHtml(sale, logo)

  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  win.onload = () => win.print()
  setTimeout(() => {
    try {
      win.print()
    } catch {
      /* ignore */
    }
  }, 400)
}
