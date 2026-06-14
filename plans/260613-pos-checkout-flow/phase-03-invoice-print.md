# Phase 03 — Invoice / Receipt Print (printToPDF)

## Context Links
- This plan: [plan.md](./plan.md)
- Research (printToPDF, A5/A4, HTML template): [research/researcher-01-checkout-transaction.md](./research/researcher-01-checkout-transaction.md) §4
- REFINES/SHARES main: [../260613-ebike-shop-crm-mvp/phase-06-warranty-maintenance.md](../260613-ebike-shop-crm-mvp/phase-06-warranty-maintenance.md) (`src/main/print.ts`)
- Sale data from: [phase-02-sale-completion-transaction.md](./phase-02-sale-completion-transaction.md)

## Overview
- **Date:** 2026-06-13
- **Description:** After a sale commits, render an HTML invoice/receipt → `webContents.printToPDF()` in a hidden BrowserWindow → save a PDF copy under `userData/invoices/` and offer to open it. A5 (slip) or A4 (full invoice). EXTENDS the SHARED `src/main/print.ts` introduced by main Phase 06 (warranty slip) — add an invoice template + `print:invoice` IPC alongside `print:warrantySlip`; do NOT create a second print module.
- **Priority:** High
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- Use `printToPDF` (silent, headless, full control) NOT `window.print()` (native dialog). Hidden `BrowserWindow({show:false})`; close after.
- Wait for render-complete before `printToPDF` (else blank/partial). Use `did-finish-load` + a small ready signal (same pattern main Phase 06 needs for slip).
- Save PDF to `app.getPath('userData')/invoices/invoice-<saleId>-<ts>.pdf` for archival; `mkdirSync(recursive)` first.
- Template is data-injected HTML; ESCAPE all customer/product text to avoid layout break / injection.
- Money formatted `toLocaleString('vi-VN')` for display only; underlying integers from `SaleResult` + line data.
- Paper: A4 invoice default; A5 landscape slip option (param `paper:'A4'|'A5'`).

## Requirements
### Functional
- IPC `print:invoice(payload)` → generates + saves PDF, returns `{ success, pdfPath }`.
- Payload: shop header (from `src/shared/shop-config.ts`, shared w/ Phase 06), saleId, saleDate, customer {name,phone}, items[{name,qty,unitPriceVnd,lineTotalVnd}], subtotalVnd, discountVnd, totalVnd, paidVnd, outstandingVnd, paymentMethod.
- Renderer post-sale "In hóa đơn" button → calls IPC → on success, toast + "Mở PDF" (open in default viewer via `shell.openPath`).
- Outstanding line shown only when `> 0` ("Còn nợ: …").
### Non-Functional
- One-page fit at A4/A5; readable Vietnamese (UTF-8, font with VN glyphs).
- Silent save (no print dialog) v1; physical print deferred (open-Q4).

## Architecture (data flow)
```
POS post-sale → window.api.print.invoice(payload)
  → ipcMain.handle('print:invoice')   [src/main/print.ts — SHARED w/ Phase 06]
       hidden BrowserWindow(show:false)
       loadURL(data: HTML  OR  template route)  → await render-ready
       printToPDF({ pageSize, landscape, margins, printBackground:true })
       mkdir userData/invoices → writeFile
       win.close()
  → { success, pdfPath }  → renderer toast + "Mở PDF" (shell.openPath)
```

## printToPDF handler (extends shared src/main/print.ts)
```ts
import { ipcMain, BrowserWindow, app, shell } from 'electron'
import path from 'path'; import fs from 'fs'
import { renderInvoiceHtml } from './templates/invoice'   // pure fn → HTML string (escaped)

ipcMain.handle('print:invoice', async (_e, payload) => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } })
  try {
    const html = renderInvoiceHtml(payload)            // escapes all text fields
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    // render-ready: data: URL is synchronous-ish; loadURL resolves after load.
    const pdf = await win.webContents.printToPDF({
      pageSize: payload.paper ?? 'A4',
      landscape: payload.paper === 'A5',
      printBackground: true,
      margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }, // cm
    })
    const dir = path.join(app.getPath('userData'), 'invoices')
    fs.mkdirSync(dir, { recursive: true })
    const pdfPath = path.join(dir, `invoice-${payload.saleId}-${Date.now()}.pdf`)
    await fs.promises.writeFile(pdfPath, pdf)
    return { success: true, pdfPath }
  } finally {
    win.close()
  }
})
// renderer "Mở PDF": window.api.shell.openPath(pdfPath)  → shell.openPath in main
```

### Template (escape!) — `src/main/templates/invoice.ts`
```ts
const esc = (s='') => String(s).replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!))
const vnd = (n:number) => n.toLocaleString('vi-VN')
export function renderInvoiceHtml(d): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${d.paper ?? 'A4'}; margin: 1cm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#111; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th,td { text-align:left; padding:4px 6px; border-bottom:1px solid #ddd; }
    .r { text-align:right; } .tot { font-weight:bold; }
  </style></head><body>
    <h2>${esc(d.shop.name)}</h2>
    <div>${esc(d.shop.address)} · ${esc(d.shop.phone)}</div>
    <h3>Hóa đơn #${d.saleId} — ${esc(d.saleDate)}</h3>
    <div>Khách: ${esc(d.customer?.name ?? 'Khách lẻ')} ${esc(d.customer?.phone ?? '')}</div>
    <table><thead><tr><th>Sản phẩm</th><th class="r">SL</th>
      <th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead><tbody>
      ${d.items.map(i=>`<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td>
        <td class="r">${vnd(i.unitPriceVnd)}</td><td class="r">${vnd(i.lineTotalVnd)}</td></tr>`).join('')}
    </tbody></table>
    <p class="r">Tạm tính: ${vnd(d.subtotalVnd)} ₫<br>
      Giảm giá: -${vnd(d.discountVnd)} ₫<br>
      <span class="tot">Tổng: ${vnd(d.totalVnd)} ₫</span><br>
      Đã trả: ${vnd(d.paidVnd)} ₫
      ${d.outstandingVnd>0 ? `<br>Còn nợ: ${vnd(d.outstandingVnd)} ₫` : ''}</p>
  </body></html>`
}
```

## Related Code Files
**Modify (SHARED w/ main Phase 06 — extend, don't duplicate):**
- `src/main/print.ts` — add `print:invoice` handler beside `print:warrantySlip`. OVERLAP.
- `src/renderer/src/features/pos/PosPage.tsx` — wire "In hóa đơn" post-sale button. OVERLAP w/ Phase 01.
- `src/shared/shop-config.ts` — shop header constants (created by Phase 06; reuse). OVERLAP.
- `src/preload/index.ts`, `src/preload/index.d.ts` — expose `api.print.invoice`, `api.shell.openPath`.
**Create:**
- `src/main/templates/invoice.ts` — `renderInvoiceHtml` (escaped, A4/A5).

## Implementation Steps
1. Create `renderInvoiceHtml` pure fn (escape all text; integer→`vi-VN`).
2. Add `print:invoice` to `src/main/print.ts` per snippet (hidden window → printToPDF → save to userData/invoices).
3. Add `shell.openPath` IPC (`shell:openPath`) so renderer can open the saved PDF.
4. Preload: expose `api.print.invoice(payload)` + `api.shell.openPath(path)`; type in `index.d.ts`.
5. POS post-sale: build payload from `SaleResult` + cart lines + shop-config → call invoice; on success toast + "Mở PDF".
6. Test A4 then A5 (`paper:'A5'`); verify one-page fit + VN glyphs render.

## Todo List
- [ ] renderInvoiceHtml (escaped, A4/A5, vi-VN)
- [ ] print:invoice handler in shared print.ts (save userData/invoices)
- [ ] shell:openPath IPC
- [ ] preload expose print.invoice + shell.openPath
- [ ] POS "In hóa đơn" button wired to SaleResult payload
- [ ] A4 + A5 render verified

## Success Criteria
- After a sale, clicking "In hóa đơn" saves `invoice-<saleId>-<ts>.pdf` under userData/invoices and opens it.
- PDF shows shop header, items, subtotal/discount/total/paid, and "Còn nợ" only when outstanding > 0.
- VN text correct; one page at A4; A5 option works.
- Special chars in customer/product names do not break layout (escaped).

## Risk Assessment
- **printToPDF before render done (MED):** blank PDF. Mitigate: await `loadURL` (data: URL); if using a route, add did-finish-load + ready signal (same as Phase 06 slip).
- **Missing VN font glyphs (LOW):** Mitigate: use system font with VN coverage (Segoe UI/Arial); test.
- **userData write fail / locked file (LOW):** Mitigate: mkdir recursive; wrap in try/finally; surface error toast.
- **Duplicate print modules (MED):** Mitigate: SHARE `src/main/print.ts` with Phase 06; one module, two handlers.

## Security Considerations
- Hidden window: `contextIsolation:true`, no `nodeIntegration`. Pass data via IPC payload/data-URL, not remote content.
- ESCAPE every text field injected into HTML (prevents layout break + HTML injection).
- Do not load remote URLs into the print window.

## Next Steps
- Optional v2: direct physical print (`webContents.print({silent:false})`) + thermal — out of scope (open-Q4).
- Main Phase 06 reuses the same window/ready pattern for warranty slip.
