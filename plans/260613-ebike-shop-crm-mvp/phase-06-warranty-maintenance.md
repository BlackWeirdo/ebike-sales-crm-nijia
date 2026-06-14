# Phase 06 — Warranty + Maintenance

## Context Links
- Overview: [plan.md](./plan.md)
- Domain model (multi-record warranty, print): [../research/researcher-02-domain-model.md](./research/researcher-02-domain-model.md)
- Stack research (printToPDF): [../research/260613-electron-stack-research.md](./research/260613-electron-stack-research.md)
- Depends on: [phase-04-pos-sales.md](./phase-04-pos-sales.md), [phase-05-customers.md](./phase-05-customers.md)

## Overview
- **Date:** 2026-06-13
- **Description:** Fill the warranty/reminder helper stubbed in Phase 04: auto-create frame + battery warranty records (and a maintenance reminder) when a bike is sold. Lookup warranty by serial. Compute end dates + upcoming service. Print A5/A4 warranty slip via `printToPDF`/`window.print()`.
- **Priority:** High (key differentiator for e-bike shop)
- **Implementation status:** Not Started
- **Review status:** Not Reviewed

## Key Insights
- One bike sale → multiple warranty rows: frame (use `product.warrantyFrameMonths`) + battery (`warrantyBatteryMonths`). Skip a component if its months = 0.
- `end_date` computed `dayjs(startDate).add(months,'month')`, NEVER stored.
- Maintenance reminder: `next_service_date = saleDate + serviceIntervalMonths` (if interval > 0). Dashboard/customer profile list reminders where date within window.
- Warranty status = `end_date >= today ? active : expired` (computed, no enum).
- Print: render an HTML template (hidden BrowserWindow OR offscreen) → `webContents.printToPDF()` to save PDF, and/or `webContents.print()` for direct printer. KISS: a dedicated hidden window loading a template route, populated via query/IPC.

## Requirements
### Functional
- On bike sale: auto-insert frame/battery warranty rows + maintenance reminder (replaces Phase 04 stub).
- Warranty lookup page: search by serial → show unit, customer, all warranty rows with start/end/status, owner.
- Maintenance list: upcoming service (next 30 days) + overdue.
- Mark reminder done/skipped.
- Print warranty slip (A5 default, A4 option): shop header, customer, serial, model, frame end date, battery end date, dates. Save PDF + optional direct print.

### Non-Functional
- Slip prints on standard A5/A4 printer, readable, fits one page.
- Date math via shared `warrantyEndDate` helper.

## Architecture
- Fill `src/main/repos/_hooks.ts::createWarrantiesForSale`.
- IPC: `warranty:lookupBySerial`, `warranty:listActive`, `maintenance:upcoming`, `maintenance:updateStatus`, `print:warrantySlip`.
- Print flow: main creates/uses hidden `BrowserWindow`, loads warranty template route with data, then `printToPDF` → save via `dialog.showSaveDialog`, or `webContents.print({silent:false})`.

## createWarrantiesForSale (fill stub)
```ts
createWarrantiesForSale(saleId, dto) {
  for (const line of dto.items) {
    if (!line.inventoryUnitId) continue            // only serialized bikes
    const p = productsRepo.get(line.productId)
    const start = dto.saleDate
    if (p.warrantyFrameMonths > 0)
      db.insert(warrantyRecords).values({ inventoryUnitId: line.inventoryUnitId, saleId,
        customerId: dto.customerId, componentType:'frame', startDate:start, months:p.warrantyFrameMonths }).run()
    if (p.warrantyBatteryMonths > 0)
      db.insert(warrantyRecords).values({ ...battery... }).run()
    if (p.serviceIntervalMonths > 0)
      db.insert(maintenanceReminders).values({ inventoryUnitId: line.inventoryUnitId,
        customerId: dto.customerId, nextServiceDate: dayjs(start).add(p.serviceIntervalMonths,'month').format('YYYY-MM-DD') }).run()
  }
}
```
(Called INSIDE Phase 04 sale transaction → atomic.)

## printToPDF call (`src/main/print.ts`)
```ts
async function printWarrantySlip(data, paper /* 'A5'|'A4' */) {
  const win = new BrowserWindow({ show:false, webPreferences:{ contextIsolation:true } })
  await win.loadURL(slipUrl)                       // template route, data via query or IPC
  // wait for render-complete signal
  const pdf = await win.webContents.printToPDF({
    pageSize: paper, printBackground: true,
    margins: { marginType:'custom', top:0.4, bottom:0.4, left:0.4, right:0.4 }
  })
  const { filePath } = await dialog.showSaveDialog({ defaultPath:`baohanh-${data.serial}.pdf` })
  if (filePath) fs.writeFileSync(filePath, pdf)
  // optional direct print: win.webContents.print({ silent:false })
  win.close()
}
```

## Related Code Files
**Create:**
- `src/renderer/src/features/warranty/WarrantyLookupPage.tsx`
- `.../warranty/WarrantySlipPreview.tsx` (on-screen preview)
- `.../maintenance/MaintenancePage.tsx`
- `src/renderer/src/print/WarrantySlip.tsx` + `warranty-slip.css` (@page A5/A4, print styles)
- `src/main/print.ts`
- `src/main/repos/warranty.ts`, `src/main/repos/maintenance.ts`
- `src/main/ipc/{warranty,maintenance,print}.ts`
**Modify:**
- `src/main/repos/_hooks.ts` (implement createWarrantiesForSale)
- `src/renderer/.../pos/PosPage.tsx` (enable "In phiếu bảo hành" button)
- `src/renderer/.../customers/profile/{WarrantyTab,MaintenanceTab}.tsx` (real data)
- preload/index.ts, index.d.ts

## Implementation Steps
1. Implement `createWarrantiesForSale` per snippet; confirm it runs in Phase-04 txn (sell a bike → rows appear).
2. `warranty.ts`: `lookupBySerial(serial)` join unit→product→customer + all warranty rows (add computed `endDate`,`active` in JS). `activeByCustomer(id)`.
3. `maintenance.ts`: `upcoming(days=30)`, `updateStatus(id, status)`, `upcomingByCustomer(id)`.
4. WarrantyLookupPage: serial input → results card (model, serial, owner, frame/battery end dates, status badges).
5. MaintenancePage: table of pending reminders sorted by date; overdue red; actions done/skip.
6. Build print template `WarrantySlip.tsx` with print CSS `@page { size: A5; }` (toggle A4). Use shop name/address constants (config file `src/shared/shop-config.ts`).
7. `print.ts` printWarrantySlip: hidden window → render → printToPDF → save dialog; expose `print:warrantySlip` IPC. Add a `silent:false` direct-print option button.
8. Wire POS post-sale button + customer Warranty tab to call print with the sale/unit data.

## Todo List
- [ ] createWarrantiesForSale implemented (frame+battery+reminder, atomic)
- [ ] lookupBySerial (computed end/status)
- [ ] maintenance upcoming + updateStatus
- [ ] WarrantyLookupPage
- [ ] MaintenancePage (overdue/done/skip)
- [ ] Print template A5/A4 + print CSS
- [ ] printToPDF save + direct print IPC
- [ ] POS + customer profile wired

## Success Criteria
- Selling a bike with frame=36mo, battery=12mo, service=6mo → creates 2 warranty rows + 1 reminder, correct end dates.
- Lookup by serial returns owner + both warranties with right active/expired status.
- Maintenance page lists the reminder; mark done removes from pending.
- Print produces a clean one-page A5 PDF with serial + both end dates; A4 option works.

## Risk Assessment
- **printToPDF before render done (MED):** blank/partial slip. Mitigate: signal render-complete (IPC from template or `did-finish-load` + small ready event) before printing.
- **@page size ignored by printer driver (LOW):** Mitigate: set both CSS `@page` and `pageSize` in printToPDF; test on real printer in Phase 10.
- **Wrong months source (LOW):** ensure pulling from product, not hardcoded.

## Security Considerations
- Hidden print window also contextIsolation on; pass data via IPC/query, no nodeIntegration.
- Sanitize text rendered into HTML template (escape) to avoid layout break from odd input.

## Next Steps
- Phase 07 fills debt helper + payments. Phase 08 dashboard surfaces warranty-expiring + maintenance-due alerts.
